import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AgentMessage, AgentStep, CodeChange, ToolCall } from '@/types/agent';

interface UseAgentChatProps {
  onCodeChange?: (change: CodeChange) => void;
  onApplyCode?: (code: string, fileName: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export const useAgentChat = ({ onCodeChange, onApplyCode }: UseAgentChatProps = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "👋 Hi! I'm **Replit Agent** - your AI coding partner.\n\nI can:\n- 🔍 **Analyze** your code and find issues\n- 🛠️ **Fix bugs** and apply changes directly\n- ⚡ **Refactor** for better performance\n- 🧪 **Generate tests** for your functions\n- 📝 **Explain** complex code\n\nI'll show you my thinking process and let you approve changes before I apply them!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const parseToolCalls = (content: string): { toolCalls: ToolCall[], cleanContent: string } => {
    const toolCalls: ToolCall[] = [];
    let cleanContent = content;
    
    // Parse tool call blocks: <tool:name>{...args}</tool>
    const toolRegex = /<tool:(\w+)>([\s\S]*?)<\/tool>/g;
    let match;
    
    while ((match = toolRegex.exec(content)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolCalls.push({
          id: generateId(),
          name: match[1] as ToolCall['name'],
          arguments: args,
          status: 'completed',
        });
        cleanContent = cleanContent.replace(match[0], '');
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return { toolCalls, cleanContent: cleanContent.trim() };
  };

  const parseCodeChanges = (content: string): { codeChanges: CodeChange[], cleanContent: string } => {
    const codeChanges: CodeChange[] = [];
    let cleanContent = content;
    
    // Parse code change blocks: <code_change file="name" desc="description">...</code_change>
    const codeRegex = /<code_change\s+file="([^"]+)"\s+(?:lang="([^"]+)"\s+)?desc="([^"]+)">([\s\S]*?)<\/code_change>/g;
    let match;
    
    while ((match = codeRegex.exec(content)) !== null) {
      codeChanges.push({
        fileName: match[1],
        language: match[2] || 'typescript',
        description: match[3],
        newCode: match[4].trim(),
      });
      cleanContent = cleanContent.replace(match[0], '');
    }
    
    return { codeChanges, cleanContent: cleanContent.trim() };
  };

  const parseThinkingBlocks = (content: string): { steps: AgentStep[], cleanContent: string } => {
    const steps: AgentStep[] = [];
    let cleanContent = content;
    
    // Parse thinking blocks: <thinking>...</thinking>
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
    let match;
    
    while ((match = thinkingRegex.exec(content)) !== null) {
      steps.push({
        id: generateId(),
        type: 'thinking',
        content: match[1].trim(),
        timestamp: new Date(),
        isCollapsed: true,
      });
      cleanContent = cleanContent.replace(match[0], '');
    }
    
    return { steps, cleanContent: cleanContent.trim() };
  };

  const processAgentResponse = (rawContent: string): { 
    content: string; 
    steps: AgentStep[];
    hasCodeChanges: boolean;
  } => {
    let content = rawContent;
    const allSteps: AgentStep[] = [];
    
    // Parse thinking blocks
    const { steps: thinkingSteps, cleanContent: afterThinking } = parseThinkingBlocks(content);
    allSteps.push(...thinkingSteps);
    content = afterThinking;
    
    // Parse tool calls
    const { toolCalls, cleanContent: afterTools } = parseToolCalls(content);
    toolCalls.forEach(tc => {
      allSteps.push({
        id: tc.id,
        type: 'tool_call',
        content: `Running ${tc.name}...`,
        timestamp: new Date(),
        toolCall: tc,
      });
    });
    content = afterTools;
    
    // Parse code changes
    const { codeChanges, cleanContent: afterCode } = parseCodeChanges(content);
    codeChanges.forEach(cc => {
      allSteps.push({
        id: generateId(),
        type: 'code_change',
        content: cc.description,
        timestamp: new Date(),
        codeChange: cc,
      });
      
      // Notify about code change
      if (onCodeChange) {
        onCodeChange(cc);
      }
    });
    content = afterCode;
    
    return {
      content,
      steps: allSteps,
      hasCodeChanges: codeChanges.length > 0,
    };
  };

  const sendMessage = useCallback(async (
    messageContent: string,
    context: {
      currentFile?: { name: string; language?: string; content?: string } | null;
      consoleErrors?: string;
      agentMode?: boolean;
    } = {}
  ) => {
    if (!messageContent.trim() || isLoading) return;

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: '🔒 **Authentication Required**\n\nPlease sign in to use the AI assistant.',
      }]);
      return;
    }

    const userMessage: AgentMessage = {
      id: generateId(),
      role: 'user',
      content: messageContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setCurrentStep('Thinking...');

    const assistantId = generateId();
    let fullContent = '';

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messages.slice(1).concat(userMessage).map(m => ({
            role: m.role,
            content: m.content,
          })),
          currentFile: context.currentFile ? {
            name: context.currentFile.name,
            language: context.currentFile.language,
            content: context.currentFile.content?.slice(0, 10000),
          } : null,
          consoleErrors: context.consoleErrors || null,
          agentMode: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      // Create initial assistant message
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              
              // Update thinking indicator based on content
              if (fullContent.includes('<thinking>') && !fullContent.includes('</thinking>')) {
                setCurrentStep('Analyzing...');
              } else if (fullContent.includes('<code_change')) {
                setCurrentStep('Preparing changes...');
              } else {
                setCurrentStep(null);
              }
              
              // Process and update message
              const processed = processAgentResponse(fullContent);
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, ...processed, isStreaming: true }
                    : m
                )
              );
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final processing
      const processed = processAgentResponse(fullContent);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, ...processed, isStreaming: false }
            : m
        )
      );

    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      
      console.error('Agent chat error:', error);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]);
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
      abortControllerRef.current = null;
    }
  }, [isLoading, messages, onCodeChange]);

  const applyCodeChange = useCallback((change: CodeChange) => {
    if (onApplyCode) {
      onApplyCode(change.newCode, change.fileName);
    }
  }, [onApplyCode]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: "👋 Conversation cleared! How can I help you?",
    }]);
  }, []);

  return {
    messages,
    isLoading,
    currentStep,
    sendMessage,
    applyCodeChange,
    stopGeneration,
    clearMessages,
  };
};
