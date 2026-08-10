import { describe, expect, it } from 'vitest';
import { csvEscape, csvLine } from './csv';

describe('csvEscape — spreadsheet formula injection (§9.3.4, §9.3.8)', () => {
  it('neutralizes every formula-leading character', () => {
    // Excel and Sheets execute a cell starting with any of these on open. A
    // job code or a driver name is attacker-influenced input in a file a fleet
    // owner downloads and double-clicks.
    expect(csvEscape('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvEscape('+1234')).toBe("'+1234");
    expect(csvEscape('-1234')).toBe("'-1234");
    expect(csvEscape('@import')).toBe("'@import");
  });

  it('does not touch a cell that merely contains those characters', () => {
    expect(csvEscape('A=B')).toBe('A=B');
    expect(csvEscape('12345')).toBe('12345');
  });

  it('quotes and doubles embedded quotes (RFC 4180)', () => {
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes cells containing commas or newlines', () => {
    expect(csvEscape('Bengaluru, KA')).toBe('"Bengaluru, KA"');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('applies both defences to one cell', () => {
    // Prefix first, then quote — the apostrophe must end up INSIDE the quotes
    // or the neutralisation is lost when the parser strips them.
    expect(csvEscape('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"');
  });

  it('leaves an empty cell empty', () => {
    expect(csvEscape('')).toBe('');
  });
});

describe('csvLine', () => {
  it('joins escaped cells with commas', () => {
    expect(csvLine(['a', 'b,c', '=d'])).toBe('a,"b,c",\'=d');
  });

  it('preserves empty trailing cells', () => {
    expect(csvLine(['a', '', ''])).toBe('a,,');
  });
});
