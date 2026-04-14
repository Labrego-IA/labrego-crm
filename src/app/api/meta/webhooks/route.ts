// src/app/api/meta/webhooks/route.ts
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signature verification always enforced — no bypass allowed
const META_ORG_ID = process.env.META_ORG_ID || '';
const GRAPH_VERSION = "v23.0";
const N8N_TEST_WEBHOOK_URL =
  "https://n8neditor.labregosolucoes.online/webhook-test/0ea3e24c-cdbf-426f-b4d7-8fdbbba96b88";
const CRM_ENDPOINT = process.env.CRM_ENDPOINT;

async function sendLeadToN8n(data: Record<string, any>) {
  try {
    await fetch(N8N_TEST_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error("[N8N] webhook send error:", err);
  }
}

async function sendLeadToCRM(payload: Record<string, any>) {
  if (!CRM_ENDPOINT) throw new Error("CRM_ENDPOINT not configured");
  await fetch(CRM_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** ───────────────────────── Utils ───────────────────────── **/
async function fetchLeadQuick(url: string) {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
        headers: { "user-agent": "labregoia-webhook/1.0" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await safeText(r)}`);
      return (await r.json()) as any;
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 500 + i * 400));
    }
  }
  throw lastErr;
}

async function safeText(r: Response) {
  try {
    return (await r.text()).slice(0, 400);
  } catch {
    return "";
  }
}

/** ───────────────────────── Webhook Verify (GET) ───────────────────────── **/
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

/** ───────────────────────── Webhook Receive (POST) ───────────────────────── **/
export async function POST(req: NextRequest) {
  const ab = await req.arrayBuffer();
  const rawBuf = Buffer.from(ab);

  try {
    // 1) valida assinatura ou FORM_SECRET
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const formSecretHeader = req.headers.get("x-form-secret");

    if (signatureHeader) {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        throw new Error("META_APP_SECRET not configured");
      }
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", appSecret).update(rawBuf).digest("hex");

      const sig = Buffer.from(signatureHeader);
      const exp = Buffer.from(expected);
      if (
        sig.length !== exp.length ||
        !crypto.timingSafeEqual(sig, exp)
      ) {
        throw new Error("invalid signature");
      }
    } else {
      const formSecret = process.env.FORM_SECRET;
      if (!formSecret || formSecretHeader !== formSecret) {
        throw new Error("missing or invalid signature header");
      }
    }

    // 2) parse
    const payload = JSON.parse(rawBuf.toString("utf8"));

    // 3) PROCESSA
    await processMetaPayloadDebug(payload);

    // 4) ACK
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("signature") || msg.includes("META_APP_SECRET")) {
      console.error("[META] Webhook auth error:", msg);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("[META] Webhook error (outer):", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

/** ───────────────────────── Processamento Leadgen ───────────────────────── **/
async function processMetaPayloadDebug(payload: any) {
  const db = getAdminDb();
  const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
  if (!PAGE_TOKEN) {
    console.error("[META] Missing META_PAGE_ACCESS_TOKEN");
  }
  if (!META_ORG_ID) {
    console.warn("[META] No META_ORG_ID configured — skipping lead processing");
    return;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen") {
        const leadgenId: string | undefined = change.value?.leadgen_id;
        const pageId: string | undefined = change.value?.page_id;
        if (!leadgenId) continue;

        const contact = change.value?.contact;
        if (contact) {
          const norm: Record<string, any> = {
            source: "FORM",
            createdAt: new Date(),
            pageId: pageId ?? null,
            leadgenId,
            name: contact.name || "",
            email: (contact.email || "").toLowerCase(),
            phone: contact.phone || "",
            company: contact.company || "",
            extra: {
              service: contact.service || "",
              message: contact.message || "",
            },
          };

          await sendLeadToN8n({
            name: norm.name,
            company: norm.company,
            phone: norm.phone,
            email: norm.email,
            leadgenId,
            pageId: pageId ?? null,
            source: norm.source,
            service: contact.service || "",
            message: contact.message || "",
          });

          try {
            await sendLeadToCRM(norm);
          } catch (err) {
            console.error("[CRM] webhook send error:", err);
          }

          try {
            const clientRef = db.collection("clients").doc();
            await clientRef.set({
              name: norm.name || "",
              company: norm.company || "",
              phone: norm.phone || "",
              email: norm.email || "",
              orgId: META_ORG_ID,
              status: "Lead",
              funnelStage: "Novo",
              createdAt: new Date(),
              source: norm.source,
              rawLeadId: leadgenId,
              extra: norm.extra,
            });
            try {
              let fcmQuery: FirebaseFirestore.Query = db
                .collection("fcmTokens")
                .where("role", "==", "admin");
              if (META_ORG_ID) {
                fcmQuery = fcmQuery.where("orgId", "==", META_ORG_ID);
              }
              const snap = await fcmQuery.get();
              const tokens = snap.docs.map((d) => d.id);
              if (tokens.length) {
                const message: admin.messaging.MulticastMessage = {
                  tokens,
                  notification: {
                    title: "Novo lead",
                    body: norm.name || "",
                  },
                  data: { url: "/crm" },
                };
                await admin.messaging().sendEachForMulticast(message);
              }
            } catch (err) {
              console.error("[FCM] meta lead notify error", err);
            }
          } catch (e) {
            console.error("[META] Firestore save error:", e);
          }
          continue;
        }

        if (!PAGE_TOKEN) continue;

        // 1) busca no Graph
        const fields = "created_time,ad_id,adset_id,campaign_id,form_id,field_data";
        const url =
          `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}` +
          `?fields=${encodeURIComponent(fields)}` +
          `&access_token=${encodeURIComponent(PAGE_TOKEN)}`;

        let lead: any;
        try {
          lead = await fetchLeadQuick(url);
        } catch (e) {
          console.error("[META] Lead fetch error:", e);
          continue;
        }

        // 2) normaliza campos
        const norm: Record<string, any> = {
          source: "META",
          createdAt: new Date(),
          lead_created_time: lead.created_time
            ? new Date(lead.created_time)
            : null,
          pageId: pageId ?? null,
          leadgenId,
          email: "",
          phone: "",
          name: "",
          company: "",
          extra: {},
        };

        for (const f of lead.field_data ?? []) {
          const name = (f?.name || "").toLowerCase();
          const v = Array.isArray(f?.values) ? f.values[0] : f?.values;
          switch (name) {
            case "full_name":
              norm.name = v;
              break;
            case "company_name":
              norm.company = v;
              break;
            case "first_name":
              norm.name = [v, norm.name].filter(Boolean).join(" ");
              break;
            case "last_name":
              norm.name = [norm.name, v].filter(Boolean).join(" ");
              break;
            case "email":
              norm.email = (v || "").toLowerCase();
              break;
            case "phone_number":
              norm.phone = v;
              break;
            default:
              norm.extra[name] = v;
          }
        }

        await sendLeadToN8n({
          name: norm.name,
          company: norm.company,
          phone: norm.phone,
          email: norm.email,
          leadgenId,
          pageId: pageId ?? null,
          source: norm.source,
        });

        // 3) salva em clients (coleção do CRM)
        try {
          const clientRef = db.collection("clients").doc(); // id auto
          await clientRef.set({
            name: norm.name || "",
            company: norm.company || "",
            phone: norm.phone || "",
            email: norm.email || "",
            orgId: META_ORG_ID,
            status: "Lead", // compatível com sua UI
            funnelStage: "Novo", // valor inicial
            createdAt: new Date(),
            source: "META",
            rawLeadId: leadgenId,
            extra: norm.extra,
          });
          try {
            let fcmQuery: FirebaseFirestore.Query = db
              .collection("fcmTokens")
              .where("role", "==", "admin");
            if (META_ORG_ID) {
              fcmQuery = fcmQuery.where("orgId", "==", META_ORG_ID);
            }
            const snap = await fcmQuery.get();
            const tokens = snap.docs.map((d) => d.id);
            if (tokens.length) {
              const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: {
                  title: "Novo lead",
                  body: norm.name || "",
                },
                data: { url: "/crm" },
              };
              await admin.messaging().sendEachForMulticast(message);
            }
          } catch (err) {
            console.error("[FCM] meta lead notify error", err);
          }
        } catch (e) {
          console.error("[META] Firestore save error:", e);
        }
      } else if (change.field === "messages") {
        const contact = change.value?.contacts?.[0];
        const msg = change.value?.messages?.[0];
        const waId: string | undefined = contact?.wa_id;
        if (!waId) continue;

        const norm = {
          name: contact?.profile?.name || "",
          phone: waId,
          source: "WHATSAPP",
          lastMessage: msg?.text?.body || "",
        };

        await sendLeadToN8n({
          name: norm.name,
          phone: norm.phone,
          source: norm.source,
          lastMessage: norm.lastMessage,
        });

        try {
          const clientRef = db.collection("clients").doc();
          await clientRef.set({
            name: norm.name,
            phone: norm.phone,
            orgId: META_ORG_ID,
            status: "Lead",
            funnelStage: "Novo",
            source: norm.source,
            createdAt: new Date(),
            extra: { lastMessage: norm.lastMessage },
          });
          try {
            let fcmQuery: FirebaseFirestore.Query = db
              .collection("fcmTokens")
              .where("role", "==", "admin");
            if (META_ORG_ID) {
              fcmQuery = fcmQuery.where("orgId", "==", META_ORG_ID);
            }
            const snap = await fcmQuery.get();
            const tokens = snap.docs.map((d) => d.id);
            if (tokens.length) {
              const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: {
                  title: "Novo lead WhatsApp",
                  body: norm.name || norm.phone,
                },
                data: { url: "/crm" },
              };
              await admin.messaging().sendEachForMulticast(message);
            }
          } catch (err) {
            console.error("[FCM] whatsapp lead notify error", err);
          }
        } catch (e) {
          console.error("[META] WhatsApp lead save error:", e);
        }

      }
    }
  }
}

/** ───────────────────────── Verbos não permitidos ───────────────────────── **/
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

function methodNotAllowed() {
  return new NextResponse(null, { status: 405 });
}
