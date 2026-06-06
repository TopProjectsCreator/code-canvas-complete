import { useCallback, useRef, useState } from "react";
import {
  Heading1, FunctionSquare, Radical, Superscript, Subscript,
  Sigma, Pi, Variable, Bold, Italic, Underline as UnderlineIcon,
  Code2, Link, List, ListOrdered, Table, Image,
  Quote, WrapText, Hash, Infinity as InfinityIcon, ArrowRight,
  Braces, Square, Search, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  mathStructures, greekLetters, sectionCommands, environments,
  textStyles, symbols, insertCommands, type LatexCommand,
} from "./latexData";

interface TexToolbarProps {
  onInsert: (text: string, cursorOffset?: number) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

function ToolbarButton({ icon: Icon, tooltip, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClick}>
          <Icon className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SearchableCommandDropdown({ items, label, icon: Icon, onSelect }: {
  items: LatexCommand[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: (item: LatexCommand) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? items.filter((i) =>
        i.label.toLowerCase().includes(search.toLowerCase()) ||
        i.command.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Icon className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
            <CommandGroup>
              {filtered.map((item) => (
                <CommandItem
                  key={item.command}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center gap-2"
                >
                  <code className="text-xs font-mono text-syntax-keyword">{item.command}</code>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SimpleDropdown({ items, label, icon: Icon, onSelect }: {
  items: LatexCommand[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: (item: LatexCommand) => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Icon className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.command} onSelect={() => onSelect(item)}>
            <code className="text-xs font-mono text-syntax-keyword mr-2">{item.command}</code>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const TexToolbar = ({ onInsert, editorRef }: TexToolbarProps) => {
  const handleCommand = useCallback((item: LatexCommand) => {
    onInsert(item.insert, item.cursorOffset);
  }, [onInsert]);

  return (
    <TooltipProvider>
      <div className="border-b border-border bg-muted/30">
        {/* Row 1: Math structures + Text styles */}
        <div className="flex items-center gap-0.5 px-2 py-1 flex-wrap">
          <ToolbarButton icon={Braces} tooltip="Fraction (Ctrl+Shift+F)" onClick={() => handleCommand(mathStructures[0])} />
          <ToolbarButton icon={Radical} tooltip="Square Root (Ctrl+Shift+R)" onClick={() => handleCommand(mathStructures[1])} />
          <ToolbarButton icon={Superscript} tooltip="Superscript (Ctrl+Shift+Up)" onClick={() => handleCommand(mathStructures[3])} />
          <ToolbarButton icon={Subscript} tooltip="Subscript (Ctrl+Shift+Down)" onClick={() => handleCommand(mathStructures[4])} />
          <ToolbarButton icon={FunctionSquare} tooltip="Integral" onClick={() => handleCommand(mathStructures[5])} />
          <ToolbarButton icon={Sigma} tooltip="Summation" onClick={() => handleCommand(mathStructures[6])} />
          <ToolbarButton icon={Pi} tooltip="Product" onClick={() => handleCommand(mathStructures[7])} />
          <ToolbarButton icon={InfinityIcon} tooltip="Limit" onClick={() => handleCommand(mathStructures[8])} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolbarButton icon={Bold} tooltip="Bold (Ctrl+B)" onClick={() => handleCommand(textStyles[0])} />
          <ToolbarButton icon={Italic} tooltip="Italic (Ctrl+I)" onClick={() => handleCommand(textStyles[1])} />
          <ToolbarButton icon={UnderlineIcon} tooltip="Underline (Ctrl+U)" onClick={() => handleCommand(textStyles[2])} />
          <ToolbarButton icon={Code2} tooltip="Monospace" onClick={() => handleCommand(textStyles[3])} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolbarButton icon={Heading1} tooltip="Section" onClick={() => handleCommand(sectionCommands[0])} />
          <ToolbarButton icon={Type} tooltip="Subsection" onClick={() => handleCommand(sectionCommands[1])} />

          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground mr-1">.tex</span>
        </div>

        {/* Row 2: Searchable dropdowns + environment dropdowns + inserts */}
        <div className="flex items-center gap-0.5 px-2 py-1 flex-wrap border-t border-border/50">
          <SearchableCommandDropdown items={greekLetters} label="Greek Letters" icon={Variable} onSelect={handleCommand} />
          <SearchableCommandDropdown items={symbols} label="Symbols" icon={Hash} onSelect={handleCommand} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <SimpleDropdown items={sectionCommands} label="Sections" icon={List} onSelect={handleCommand} />
          <SimpleDropdown items={environments} label="Environments" icon={Square} onSelect={handleCommand} />
          <SimpleDropdown items={textStyles} label="Text Styles" icon={WrapText} onSelect={handleCommand} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <SimpleDropdown items={insertCommands} label="Insert" icon={Link} onSelect={handleCommand} />
          <SimpleDropdown items={mathStructures} label="Math" icon={FunctionSquare} onSelect={handleCommand} />
        </div>
      </div>
    </TooltipProvider>
  );
};
