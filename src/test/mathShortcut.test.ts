import { describe, expect, it } from 'vitest';
import { detectMathShortcut } from '@/hooks/useAgentChat';

describe('calculator shortcut detection', () => {
  it.each([
    ['2 + 2', '4'],
    ['what is 12 * 7', '84'],
    ['calculate 15% of 80', '12'],
    ['(10 + 5) / 3', '5'],
  ])('calculates %s immediately', (input, result) => {
    expect(detectMathShortcut(input)).toMatchObject({ result });
  });

  it.each([
    ['I have 3 apples and buy 4 more. How many apples do I have?', '7'],
    ['There are 10 apples and 3 are used. How many remain?', '7'],
    ['There are 3 rows of 5 chairs. How many chairs?', '15'],
    ['Share 20 cookies equally among 4 children. How many each?', '5'],
  ])('solves the word problem %s', (input, result) => {
    expect(detectMathShortcut(input)).toMatchObject({ expression: input, result });
  });

  it('preserves the original percent expression', () => {
    expect(detectMathShortcut('calculate 15% of 80')).toMatchObject({
      expression: '15% of 80',
      result: '12',
    });
  });

  it('keeps the selected expression for natural language arithmetic', () => {
    expect(detectMathShortcut('what is 12 * 7')).toMatchObject({
      expression: '12 * 7',
      result: '84',
    });
  });

  it('preserves quadratic walkthrough and answer', () => {
    expect(detectMathShortcut('solve x^2 - 5x + 6 = 0')).toMatchObject({
      expression: 'x^2 - 5x + 6 = 0',
      solution: 'x = 3 and x = 2',
    });
  });

  it.each([
    '',
    'What is the reason why you talk so weirdly?',
    'What is the code on line 78-79?',
    'How many lines are in file 12?',
    'Please explain variable foo2',
    'what is 12',
    'calculate fifteen percent of eighty',
    '2 +',
    'I like 3 apples and 4 oranges.',
  ])('does not open the calculator for %s', (input) => {
    expect(detectMathShortcut(input)).toBeNull();
  });
});