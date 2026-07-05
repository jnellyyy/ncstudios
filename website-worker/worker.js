const SUPABASE_URL = "https://qimgavpfscpnlsbxjhbk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CIR45TS0FmiV_RiQZBqhfg_-mDFUqT7";
const META_PREFIX = "_nc/client-vault";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const WEDDING_CATEGORIES = [
  "Details",
  "Getting Ready",
  "Ceremony",
  "Couple Portraits",
  "Wedding Party & Family",
  "Reception",
  "Speeches",
  "First Dance",
  "Evening Party",
  "Films",
  "Documents",
  "Unsorted"
];

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/client-vault") {
        return await handleAdminRequest(request, env, url);
      }

      if (url.pathname === "/api/client-delivery") {
        return await handleClientRequest(request, env, url);
      }

      if (!env.ASSETS) {
        return new Response("Website assets are not configured.", { status: 503 });
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("NC client vault error", error);
      return json({ error: "The client vault could not complete that request." }, 500);
    }
  }
};

async function handleAdminRequest(request, env, url) {
  const bucketError = requireBucket(env);
  if (bucketError) return bucketError;

  const admin = await verifyAdmin(request);
  if (!admin.ok) return admin.response;

  const action = url.searchParams.get("action") || "list";

  if (request.method === "GET" && action === "list") {
    return json({ deliveries: await listDeliveries(env.CLIENT_DELIVERIES) });
  }

  if (request.method === "GET" && action === "status") {
    return json({ ready: true, aiReady: Boolean(env.AI), user: admin.user.email || "NC Studio" });
  }

  if (request.method === "POST" && action === "classify-image") {
    if (!env.AI) {
      return json({ error: "Smart sorting is not connected yet.", aiSetupRequired: true }, 503);
    }

    const contentType = cleanText(request.headers.get("content-type"), 80);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/")) return json({ error: "Only image previews can be sorted." }, 415);
    if (contentLength > 1_500_000) return json({ error: "That image preview is too large to sort." }, 413);

    const image = await request.arrayBuffer();
    if (!image.byteLength || image.byteLength > 1_500_000) {
      return json({ error: "That image preview could not be sorted." }, 400);
    }

    try {
      const suggestion = await classifyWeddingImage(env.AI, image, contentType);
      return json(suggestion);
    } catch (error) {
      console.error("NC smart sort error", error);
      return json({ error: "Smart sorting is temporarily unavailable. The photo was left in Unsorted." }, 503);
    }
  }

  if (request.method === "POST" && action === "create") {
    const body = await readJson(request);
    const id = crypto.randomUUID();
    const token = randomToken(24);
    const now = new Date().toISOString();
    const delivery = {
      id,
      token,
      coupleName: cleanText(body.coupleName, 120),
      projectTitle: cleanText(body.projectTitle, 160) || "Your NC Studio delivery",
      eventDate: cleanDate(body.eventDate),
      message: cleanText(body.message, 1200),
      status: "draft",
      expiresAt: cleanDate(body.expiresAt),
      pinHash: body.pin ? await hashPin(id, body.pin) : "",
      files: [],
      opens: 0,
      lastOpenedAt: "",
      createdAt: now,
      updatedAt: now
    };

    if (!delivery.coupleName) return json({ error: "Add the couple name first." }, 400);

    await saveDelivery(env.CLIENT_DELIVERIES, delivery);
    await putJson(env.CLIENT_DELIVERIES, tokenKey(token), { deliveryId: id });
    return json({ delivery: publicAdminDelivery(delivery) }, 201);
  }

  if (request.method === "POST" && action === "update") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery) return json({ error: "Delivery not found." }, 404);

    if (body.coupleName !== undefined) delivery.coupleName = cleanText(body.coupleName, 120);
    if (body.projectTitle !== undefined) delivery.projectTitle = cleanText(body.projectTitle, 160);
    if (body.eventDate !== undefined) delivery.eventDate = cleanDate(body.eventDate);
    if (body.message !== undefined) delivery.message = cleanText(body.message, 1200);
    if (body.expiresAt !== undefined) delivery.expiresAt = cleanDate(body.expiresAt);
    if (["draft", "live", "disabled"].includes(body.status)) delivery.status = body.status;
    if (body.clearPin) delivery.pinHash = "";
    if (body.pin) delivery.pinHash = await hashPin(delivery.id, body.pin);
    delivery.updatedAt = new Date().toISOString();

    await saveDelivery(env.CLIENT_DELIVERIES, delivery);
    return json({ delivery: publicAdminDelivery(delivery) });
  }

  if (request.method === "POST" && action === "delete") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery) return json({ deleted: true });

    await deletePrefix(env.CLIENT_DELIVERIES, `clients/${delivery.id}/`);
    await env.CLIENT_DELIVERIES.delete([deliveryKey(delivery.id), tokenKey(delivery.token)]);
    return json({ deleted: true });
  }

  if (request.method === "POST" && action === "start-upload") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery) return json({ error: "Delivery not found." }, 404);

    const fileId = crypto.randomUUID();
    const name = cleanFileName(body.name);
    const type = cleanText(body.type, 120) || "application/octet-stream";
    const key = `clients/${delivery.id}/${fileId}-${name}`;
    const upload = await env.CLIENT_DELIVERIES.createMultipartUpload(key, {
      httpMetadata: {
        contentType: type,
        contentDisposition: `inline; filename="${name}"`
      },
      customMetadata: {
        deliveryId: delivery.id,
        fileId,
        originalName: name
      }
    });

    return json({
      uploadId: upload.uploadId,
      key,
      fileId,
      name,
      type,
      size: safeNumber(body.size)
    });
  }

  if (request.method === "PUT" && action === "upload-part") {
    const id = url.searchParams.get("id") || "";
    const key = url.searchParams.get("key") || "";
    const uploadId = url.searchParams.get("uploadId") || "";
    const partNumber = Number(url.searchParams.get("partNumber"));

    if (!validDeliveryFileKey(id, key) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
      return json({ error: "Invalid upload part." }, 400);
    }

    const multipart = env.CLIENT_DELIVERIES.resumeMultipartUpload(key, uploadId);
    const part = await multipart.uploadPart(partNumber, request.body);
    return json({ partNumber: part.partNumber, etag: part.etag });
  }

  if (request.method === "POST" && action === "complete-upload") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery || !validDeliveryFileKey(body.id, body.key)) {
      return json({ error: "Delivery or file upload not found." }, 404);
    }

    const multipart = env.CLIENT_DELIVERIES.resumeMultipartUpload(body.key, body.uploadId);
    await multipart.complete(normaliseParts(body.parts));

    const file = {
      id: cleanText(body.fileId, 80),
      key: body.key,
      name: cleanFileName(body.name),
      type: cleanText(body.type, 120) || "application/octet-stream",
      size: safeNumber(body.size),
      category: cleanCategory(body.category, body.type),
      createdAt: new Date().toISOString()
    };

    delivery.files = (delivery.files || []).filter(item => item.id !== file.id);
    delivery.files.push(file);
    delivery.updatedAt = new Date().toISOString();
    await saveDelivery(env.CLIENT_DELIVERIES, delivery);
    return json({ file: publicFile(file), delivery: publicAdminDelivery(delivery) });
  }

  if (request.method === "POST" && action === "abort-upload") {
    const body = await readJson(request);
    if (validDeliveryFileKey(body.id, body.key) && body.uploadId) {
      const multipart = env.CLIENT_DELIVERIES.resumeMultipartUpload(body.key, body.uploadId);
      await multipart.abort();
    }
    return json({ aborted: true });
  }

  if (request.method === "POST" && action === "delete-file") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery) return json({ error: "Delivery not found." }, 404);

    const file = (delivery.files || []).find(item => item.id === body.fileId);
    if (file && validDeliveryFileKey(delivery.id, file.key)) {
      await env.CLIENT_DELIVERIES.delete(file.key);
      delivery.files = delivery.files.filter(item => item.id !== body.fileId);
      delivery.updatedAt = new Date().toISOString();
      await saveDelivery(env.CLIENT_DELIVERIES, delivery);
    }

    return json({ delivery: publicAdminDelivery(delivery) });
  }

  if (request.method === "POST" && action === "update-file") {
    const body = await readJson(request);
    const delivery = await getDelivery(env.CLIENT_DELIVERIES, body.id);
    if (!delivery) return json({ error: "Delivery not found." }, 404);

    const file = (delivery.files || []).find(item => item.id === body.fileId);
    if (!file) return json({ error: "Stored file not found." }, 404);

    file.category = cleanCategory(body.category, file.type);
    delivery.updatedAt = new Date().toISOString();
    await saveDelivery(env.CLIENT_DELIVERIES, delivery);
    return json({ file: publicFile(file), delivery: publicAdminDelivery(delivery) });
  }

  return json({ error: "Unknown client vault action." }, 404);
}

async function handleClientRequest(request, env, url) {
  const bucketError = requireBucket(env);
  if (bucketError) return bucketError;
  const action = url.searchParams.get("action") || "manifest";

  if (request.method === "POST" && action === "access") {
    const body = await readJson(request);
    const delivery = await getDeliveryByToken(env.CLIENT_DELIVERIES, body.token);
    const unavailable = clientAvailabilityError(delivery);
    if (unavailable) return unavailable;

    if (delivery.pinHash) {
      if (!body.pin) return json({ pinRequired: true }, 401);
      if (await hashPin(delivery.id, body.pin) !== delivery.pinHash) {
        return json({ error: "That PIN is not correct.", pinRequired: true }, 403);
      }
    }

    const session = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await putJson(env.CLIENT_DELIVERIES, sessionKey(session), {
      deliveryId: delivery.id,
      expiresAt
    });

    delivery.opens = Number(delivery.opens || 0) + 1;
    delivery.lastOpenedAt = new Date().toISOString();
    await saveDelivery(env.CLIENT_DELIVERIES, delivery);

    return json({ session, expiresAt, delivery: publicClientDelivery(delivery) });
  }

  if (request.method === "GET" && action === "manifest") {
    const access = await getSessionDelivery(env.CLIENT_DELIVERIES, url.searchParams.get("session"));
    if (!access.delivery) return access.response;
    return json({ delivery: publicClientDelivery(access.delivery) });
  }

  if (request.method === "GET" && action === "file") {
    const access = await getSessionDelivery(env.CLIENT_DELIVERIES, url.searchParams.get("session"));
    if (!access.delivery) return access.response;

    const file = (access.delivery.files || []).find(item => item.id === url.searchParams.get("file"));
    if (!file || !validDeliveryFileKey(access.delivery.id, file.key)) {
      return new Response("File not found.", { status: 404 });
    }

    return streamFile(request, env.CLIENT_DELIVERIES, file, url.searchParams.get("download") === "1");
  }

  return json({ error: "Unknown client delivery action." }, 404);
}

async function verifyAdmin(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "Sign in to manage client deliveries." }, 401) };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_nc_admin`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization,
        "content-type": "application/json"
      },
      body: "{}"
    });

    if (!response.ok || await response.json() !== true) {
      return { ok: false, response: json({ error: "This login is not an NC Studio administrator." }, 403) };
    }

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization }
    });
    const user = userResponse.ok ? await userResponse.json() : {};
    return { ok: true, user };
  } catch (error) {
    return { ok: false, response: json({ error: "Could not verify the studio login." }, 503) };
  }
}

function requireBucket(env) {
  if (env.CLIENT_DELIVERIES) return null;
  return json({
    error: "Client storage is not connected yet.",
    setupRequired: true,
    binding: "CLIENT_DELIVERIES"
  }, 503);
}

async function streamFile(request, bucket, file, download) {
  const object = await bucket.get(file.key, {
    range: request.headers,
    onlyIf: request.headers
  });

  if (!object) return new Response("File not found.", { status: 404 });
  if (!object.body) return new Response(null, { status: 304 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=300");
  headers.set("content-disposition", `${download ? "attachment" : "inline"}; filename="${cleanFileName(file.name)}"`);

  if (object.range) {
    const offset = object.range.offset || 0;
    const length = object.range.length || object.size;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

async function getSessionDelivery(bucket, token) {
  if (!token) return { response: json({ error: "This access session is missing." }, 401) };
  const session = await getJson(bucket, sessionKey(token));
  if (!session || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) {
    return { response: json({ error: "This access session has expired." }, 401) };
  }

  const delivery = await getDelivery(bucket, session.deliveryId);
  const unavailable = clientAvailabilityError(delivery);
  if (unavailable) return { response: unavailable };
  return { delivery };
}

function clientAvailabilityError(delivery) {
  if (!delivery || delivery.status === "disabled") return json({ error: "This delivery is not available." }, 404);
  if (delivery.status !== "live") return json({ error: "This delivery is not live yet." }, 403);
  if (delivery.expiresAt && new Date(delivery.expiresAt).getTime() < Date.now()) {
    return json({ error: "This delivery link has expired." }, 410);
  }
  return null;
}

async function listDeliveries(bucket) {
  const deliveries = [];
  let cursor;
  do {
    const result = await bucket.list({ prefix: `${META_PREFIX}/deliveries/`, cursor });
    for (const object of result.objects) {
      const delivery = await getJson(bucket, object.key);
      if (delivery) deliveries.push(publicAdminDelivery(delivery));
    }
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);

  return deliveries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function deletePrefix(bucket, prefix) {
  let cursor;
  do {
    const result = await bucket.list({ prefix, cursor });
    const keys = result.objects.map(object => object.key);
    if (keys.length) await bucket.delete(keys);
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
}

async function getDeliveryByToken(bucket, token) {
  const safeToken = cleanToken(token);
  if (!safeToken) return null;
  const index = await getJson(bucket, tokenKey(safeToken));
  return index?.deliveryId ? getDelivery(bucket, index.deliveryId) : null;
}

async function getDelivery(bucket, id) {
  const safeId = cleanId(id);
  return safeId ? getJson(bucket, deliveryKey(safeId)) : null;
}

async function saveDelivery(bucket, delivery) {
  await putJson(bucket, deliveryKey(delivery.id), delivery);
}

async function getJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return await object.json();
  } catch (error) {
    return null;
  }
}

async function putJson(bucket, key, value) {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json; charset=utf-8" }
  });
}

function publicAdminDelivery(delivery) {
  return {
    ...publicClientDelivery(delivery),
    token: delivery.token,
    hasPin: Boolean(delivery.pinHash),
    status: delivery.status,
    opens: Number(delivery.opens || 0),
    lastOpenedAt: delivery.lastOpenedAt || "",
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt
  };
}

function publicClientDelivery(delivery) {
  return {
    id: delivery.id,
    coupleName: delivery.coupleName,
    projectTitle: delivery.projectTitle,
    eventDate: delivery.eventDate || "",
    message: delivery.message || "",
    expiresAt: delivery.expiresAt || "",
    files: (delivery.files || []).map(publicFile)
  };
}

function publicFile(file) {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: Number(file.size || 0),
    category: cleanCategory(file.category, file.type),
    createdAt: file.createdAt
  };
}

async function classifyWeddingImage(ai, image, contentType) {
  const prompt = `Sort this wedding photograph into exactly one category from this list: ${WEDDING_CATEGORIES.slice(0, 9).join(", ")}, or Unsorted.

Use Details for rings, flowers, stationery, dress, shoes, tablescapes and venue details. Use Getting Ready for hair, makeup, dressing and preparations. Use Ceremony for aisle, vows, altar, signing and confetti exits. Use Couple Portraits when the couple are the clear focus away from the ceremony. Use Wedding Party & Family for posed groups, bridesmaids, groomsmen and relatives. Use Reception for room scenes, dinner, guests mingling and cake cutting. Use Speeches for microphones, toasts and speakers. Use First Dance only for the couple's first dance. Use Evening Party for dancing, DJs and late-night celebration. If uncertain, use Unsorted. Return only JSON.`;
  const response = await ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
    prompt,
    image: `data:${contentType};base64,${arrayBufferToBase64(image)}`,
    max_tokens: 60,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: WEDDING_CATEGORIES.filter(category => !["Films", "Documents"].includes(category)) }
        },
        required: ["category"]
      }
    }
  });

  const parsed = parseAiResponse(response);
  return { category: cleanCategory(parsed.category, "image/jpeg") };
}

function parseAiResponse(response) {
  if (response?.response && typeof response.response === "object") return response.response;
  const text = String(response?.response || response?.result || "").trim();
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch (error) {
    const category = WEDDING_CATEGORIES.find(item => text.toLowerCase().includes(item.toLowerCase()));
    return { category: category || "Unsorted" };
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function cleanCategory(value, type = "") {
  const requested = cleanText(value, 80);
  if (WEDDING_CATEGORIES.includes(requested)) return requested;
  if (String(type).startsWith("video/")) return "Films";
  if (!String(type).startsWith("image/")) return "Documents";
  return "Unsorted";
}

function deliveryKey(id) {
  return `${META_PREFIX}/deliveries/${id}.json`;
}

function tokenKey(token) {
  return `${META_PREFIX}/tokens/${token}.json`;
}

function sessionKey(token) {
  return `${META_PREFIX}/sessions/${token}.json`;
}

function validDeliveryFileKey(id, key) {
  const safeId = cleanId(id);
  return Boolean(safeId && String(key || "").startsWith(`clients/${safeId}/`));
}

function normaliseParts(parts) {
  if (!Array.isArray(parts) || !parts.length) throw new Error("Upload parts are missing.");
  const normalised = parts.map(part => ({
    partNumber: Number(part.partNumber),
    etag: String(part.etag || "")
  })).filter(part => Number.isInteger(part.partNumber) && part.partNumber > 0 && part.etag);
  if (normalised.length !== parts.length) throw new Error("Upload parts are invalid.");
  return normalised;
}

async function hashPin(id, pin) {
  const bytes = new TextEncoder().encode(`${id}:${String(pin || "").trim()}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function randomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanId(value) {
  const text = String(value || "").trim();
  return /^[a-f0-9-]{20,50}$/i.test(text) ? text : "";
}

function cleanToken(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{20,120}$/.test(text) ? text : "";
}

function cleanFileName(value) {
  const name = String(value || "file")
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._()' +&-]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return name || "file";
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
