import { GET as manifestGET } from '@/app/api/mcp/manifest/route';

export async function GET() {
  return manifestGET();
}
