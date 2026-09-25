import {
  api,
  type CompanyRegisterPayload,
  type JobTitleApiOut,
  type KnowledgeMaterialApiOut,
  type OrganizationApiOut,
  type RAGQueryResultApiOut,
} from "./api";

export interface Organization {
  id: string;
  name: string;
  field: string | null;
  joinCode: string;
}

export interface JobTitle {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  materialCount: number;
  chunkCount: number;
}

export interface KnowledgeMaterial {
  id: string;
  jobTitleId: string;
  filename: string | null;
  chunkCount: number;
  createdAt: string;
  preview: string;
}

export interface RAGChunk {
  id: string;
  materialId: string;
  content: string;
  score: number;
}

function toOrganization(o: OrganizationApiOut): Organization {
  return { id: o.id, name: o.name, field: o.field, joinCode: o.join_code };
}

function toJobTitle(j: JobTitleApiOut): JobTitle {
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    createdAt: j.created_at,
    materialCount: j.material_count,
    chunkCount: j.chunk_count,
  };
}

function toMaterial(m: KnowledgeMaterialApiOut): KnowledgeMaterial {
  return {
    id: m.id,
    jobTitleId: m.job_title_id,
    filename: m.filename,
    chunkCount: m.chunk_count,
    createdAt: m.created_at,
    preview: m.preview,
  };
}

/** Founds a new company, or joins an existing one via its join code —
 * see app/schemas.py's CompanyRegister for which fields matter for which
 * shape. Doesn't log the rep in; call login() after, same as the
 * student register flow. */
export async function registerCompany(payload: CompanyRegisterPayload) {
  const raw = await api.company.register(payload);
  return { user: raw.user, organization: toOrganization(raw.organization) };
}

export async function fetchMyCompany(): Promise<Organization> {
  return toOrganization(await api.company.me());
}

export async function fetchJobTitles(): Promise<JobTitle[]> {
  const raw = await api.company.listJobTitles();
  return raw.map(toJobTitle);
}

export async function fetchJobTitle(id: string): Promise<JobTitle> {
  return toJobTitle(await api.company.getJobTitle(id));
}

export async function createJobTitle(title: string, description?: string): Promise<JobTitle> {
  return toJobTitle(await api.company.createJobTitle(title, description));
}

export async function fetchMaterials(jobTitleId: string): Promise<KnowledgeMaterial[]> {
  const raw = await api.company.listMaterials(jobTitleId);
  return raw.map(toMaterial);
}

export async function uploadMaterial(
  jobTitleId: string,
  text?: string,
  file?: File
): Promise<KnowledgeMaterial> {
  return toMaterial(await api.company.uploadMaterial(jobTitleId, text, file));
}

export async function queryKnowledgeBase(
  jobTitleId: string,
  query: string,
  k?: number
): Promise<{ query: string; chunks: RAGChunk[] }> {
  const raw: RAGQueryResultApiOut = await api.company.query(jobTitleId, query, k);
  return {
    query: raw.query,
    chunks: raw.chunks.map((c) => ({
      id: c.id,
      materialId: c.material_id,
      content: c.content,
      score: c.score,
    })),
  };
}
