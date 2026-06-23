export interface TextDocument {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export class TextDocumentManager {
  private documents = new Map<string, TextDocument>();

  openDocument(uri: string, languageId: string, text: string): TextDocument {
    const doc: TextDocument = { uri, languageId, version: 1, text };
    this.documents.set(uri, doc);
    return doc;
  }

  changeDocument(uri: string, text: string): TextDocument | null {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    doc.text = text;
    doc.version++;
    return doc;
  }

  closeDocument(uri: string): boolean {
    return this.documents.delete(uri);
  }

  getDocument(uri: string): TextDocument | null {
    return this.documents.get(uri) ?? null;
  }

  getOpenUris(): string[] {
    return Array.from(this.documents.keys());
  }

  isOpen(uri: string): boolean {
    return this.documents.has(uri);
  }
}
