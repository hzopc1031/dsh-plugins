export type ProjectId = 'kafka' | 'hadoop' | 'flink'

export interface SourceMetadata {
  url: string
  fetchedAt: string
  sourceTimestamp?: string
}

export interface SourceDocument extends SourceMetadata {
  payload: string
}

export type HttpClient = (url: string) => Promise<SourceDocument>

// Shared JSON data for the later native panel and report; raw HTML stays in the cache layer.
export interface Advisory extends SourceMetadata {
  id: string
  project: ProjectId
  title: string
  products: string[]
  affectedText: string | null
  fixedText: string | null
  announcedAt?: string
  notes: string[]
}

export interface AdvisoryPage extends SourceMetadata {
  project: ProjectId
  advisories: Advisory[]
  notices: string[]
}

export interface Suppression extends SourceMetadata {
  id: string
  notes: string
}

export interface SuppressionPage extends SourceMetadata {
  suppressions: Suppression[]
  guidanceUrl: string
}

export interface ReferencePage extends SourceMetadata {
  kind: 'pointer' | 'guidance'
  title: string
  text: string
  links: string[]
}
