export const parseAIErrorResponse = (
  status: number,
  responseText: string
): string => {
  let errorMessage = `Failed to get response (${status})`;

  try {
    const error = JSON.parse(responseText);
    return error?.error || error?.message || errorMessage;
  } catch {
    const trimmed = responseText.trim();
    if (/^<!doctype html>/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      return 'Server returned HTML instead of JSON. Check API endpoint/proxy configuration.';
    }
    if (trimmed) return trimmed.slice(0, 200);
  }

  return errorMessage;
};
