import { toVercelProjectName } from "@/lib/publish/site-id";

type VercelProject = { id: string; name: string };
type VercelDeployment = { id: string; url?: string; alias?: string[] };

const VERCEL = "https://api.vercel.com";

function teamQuery(teamId: string | undefined) {
  if (!teamId?.trim()) return "";
  return `?teamId=${encodeURIComponent(teamId.trim())}`;
}

/**
 * @returns The stable *.vercel.app style URL (project alias) or the deployment inspect URL.
 */
function pickPublicUrl(
  name: string,
  deployment: VercelDeployment
): string | null {
  if (Array.isArray(deployment.alias) && deployment.alias[0]) {
    const a = deployment.alias[0];
    if (a.startsWith("http")) return a;
    return `https://${a}`;
  }
  if (deployment.url?.startsWith("http")) {
    return deployment.url;
  }
  return `https://${name}.vercel.app`;
}

/**
 * Resolves the Vercel project (create if missing) and deploys a single `index.html`.
 * Re-deploys to the same project keep the same default *.vercel.app host (new deployment, same project).
 */
export async function deployStaticSiteToVercelIfConfigured(opts: {
  siteId: string;
  html: string;
}): Promise<
  | { ok: true; projectId: string; projectName: string; deploymentId: string; publicUrl: string; raw: unknown }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "error"; message: string }
> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    return { ok: false, reason: "not_configured" };
  }
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const tq = teamQuery(teamId);

  const projectName = toVercelProjectName(opts.siteId);
  const auth = { Authorization: `Bearer ${token}` } as const;

  try {
    let projectId: string;
    const getRes = await fetch(
      `${VERCEL}/v9/projects/${encodeURIComponent(projectName)}${tq}`,
      { headers: { ...auth }, cache: "no-store" }
    );
    if (getRes.ok) {
      const p = (await getRes.json()) as VercelProject;
      projectId = p.id;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return {
        ok: false,
        reason: "error",
        message: `Vercel project lookup failed: ${getRes.status} ${errText.slice(0, 300)}`,
      };
    } else {
      const createRes = await fetch(`${VERCEL}/v9/projects${tq}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          framework: null,
        }),
        cache: "no-store",
      });
      if (createRes.status === 409) {
        const again = await fetch(
          `${VERCEL}/v9/projects/${encodeURIComponent(projectName)}${tq}`,
          { headers: { ...auth }, cache: "no-store" }
        );
        if (!again.ok) {
          return {
            ok: false,
            reason: "error",
            message: "Vercel project exists but could not be read.",
          };
        }
        projectId = ((await again.json()) as VercelProject).id;
      } else if (!createRes.ok) {
        const errText = await createRes.text();
        return {
          ok: false,
          reason: "error",
          message: `Vercel project create failed: ${createRes.status} ${errText.slice(0, 400)}`,
        };
      } else {
        const p = (await createRes.json()) as VercelProject;
        projectId = p.id;
      }
    }

    const dataB64 = Buffer.from(opts.html, "utf-8").toString("base64");
    const deployRes = await fetch(`${VERCEL}/v13/deployments${tq}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `publish-${projectName}`,
        project: projectId,
        target: "production",
        files: [{ file: "index.html", data: dataB64 }],
      }),
      cache: "no-store",
    });
    if (!deployRes.ok) {
      const errText = await deployRes.text();
      return {
        ok: false,
        reason: "error",
        message: `Vercel deploy failed: ${deployRes.status} ${errText.slice(0, 500)}`,
      };
    }
    const deployment = (await deployRes.json()) as VercelDeployment;
    const publicUrl = pickPublicUrl(projectName, deployment);
    return {
      ok: true,
      projectId,
      projectName,
      deploymentId: deployment.id,
      publicUrl: publicUrl || `https://${projectName}.vercel.app`,
      raw: deployment,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Vercel deploy error.",
    };
  }
}
