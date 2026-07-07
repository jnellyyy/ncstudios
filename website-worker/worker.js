const SUPABASE_URL = "https://qimgavpfscpnlsbxjhbk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CIR45TS0FmiV_RiQZBqhfg_-mDFUqT7";
const META_PREFIX = "_nc/client-vault";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DELIVERY_CATEGORIES = [
  "Details & Decor",
  "Getting Ready",
  "Ceremony",
  "Portraits",
  "Couple Portraits",
  "Groups & Family",
  "Guests & Candids",
  "Speeches & Toasts",
  "Reception & Party",
  "First Dance",
  "Graduation",
  "Baby Shower",
  "Baby & Family",
  "Films",
  "Documents",
  "Unsorted"
];

const LEGACY_CATEGORY_MAP = {
  "Details": "Details & Decor",
  "Wedding Party & Family": "Groups & Family",
  "Reception": "Reception & Party",
  "Speeches": "Speeches & Toasts",
  "Evening Party": "Reception & Party"
};

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
      const suggestion = await classifyDeliveryImage(env.AI, image, contentType);
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

    if (!delivery.coupleName) return json({ error: "Add the client name first." }, 400);

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

  if (request.method === "GET" && action === "download-all") {
    const access = await getSessionDelivery(env.CLIENT_DELIVERIES, url.searchParams.get("session"));
    if (!access.delivery) return access.response;
    return streamDeliveryZip(env.CLIENT_DELIVERIES, access.delivery);
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

function streamDeliveryZip(bucket, delivery) {
  const files = (delivery.files || [])
    .filter(file => file?.id && validDeliveryFileKey(delivery.id, file.key));

  if (!files.length) return json({ error: "This delivery does not have files to download yet." }, 404);

  const archiveName = `${cleanFileName(delivery.projectTitle || delivery.coupleName || "NC Studio delivery")}.zip`;
  const encoder = new TextEncoder();
  const usedNames = new Map();
  const entries = [];
  let offset = 0n;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const file of files) {
          const object = await bucket.get(file.key);
          if (!object?.body) continue;

          const category = cleanCategory(file.category, file.type);
          const folder = category === "Unsorted" ? "More from your day" : category;
          const entryName = uniqueZipEntryName(`${cleanZipPathPart(folder)}/${cleanFileName(file.name)}`, usedNames);
          const nameBytes = encoder.encode(entryName);
          const dos = dosDateTime(file.createdAt || new Date().toISOString());
          const knownSize = BigInt(object.size || file.size || 0);
          const needsZip64File = knownSize > ZIP_MAX_32;
          const entryOffset = offset;
          const localHeader = zipLocalHeader(nameBytes, dos, needsZip64File);

          controller.enqueue(localHeader);
          offset += BigInt(localHeader.length);

          let crc = 0xffffffff;
          let size = 0n;
          const reader = object.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            crc = crc32Update(crc, chunk);
            size += BigInt(chunk.length);
            offset += BigInt(chunk.length);
            controller.enqueue(chunk);
          }

          const finalCrc = (crc ^ 0xffffffff) >>> 0;
          const descriptor = zipDataDescriptor(finalCrc, size, needsZip64File || size > ZIP_MAX_32);
          controller.enqueue(descriptor);
          offset += BigInt(descriptor.length);

          entries.push({
            nameBytes,
            dos,
            crc: finalCrc,
            size,
            compressedSize: size,
            offset: entryOffset
          });
        }

        if (!entries.length) {
          throw new Error("No files could be added to this download.");
        }

        const centralOffset = offset;
        for (const entry of entries) {
          const centralHeader = zipCentralHeader(entry);
          controller.enqueue(centralHeader);
          offset += BigInt(centralHeader.length);
        }
        const centralSize = offset - centralOffset;

        const needsZip64 = entries.length > 0xffff || centralOffset > ZIP_MAX_32 || centralSize > ZIP_MAX_32 || entries.some(entry => zipEntryNeedsZip64(entry));
        if (needsZip64) {
          const zip64EocdOffset = offset;
          const zip64Eocd = zip64EndOfCentralDirectory(entries.length, centralSize, centralOffset);
          controller.enqueue(zip64Eocd);
          offset += BigInt(zip64Eocd.length);
          const locator = zip64EndOfCentralDirectoryLocator(zip64EocdOffset);
          controller.enqueue(locator);
          offset += BigInt(locator.length);
        }

        controller.enqueue(zipEndOfCentralDirectory(entries.length, centralSize, centralOffset));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${archiveName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
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

async function classifyDeliveryImage(ai, image, contentType) {
  const prompt = `Sort this NC Studio client delivery photograph into exactly one category from this list: ${DELIVERY_CATEGORIES.filter(category => !["Films", "Documents"].includes(category)).join(", ")}.

The shoot may be a wedding, graduation, baby shower, baby or newborn session, birthday, live event, family session, maternity session, engagement or other client event.

Use Details & Decor for rings, flowers, stationery, signs, dresses, shoes, tablescapes, balloons, cakes, venue details and styled decor. Use Getting Ready for hair, makeup, dressing, prep and behind-the-scenes preparation. Use Ceremony for aisle, vows, altar, signing, confetti exits, graduation stage/diploma moments or any formal ceremony. Use Portraits for one main subject, including graduates, maternity portraits and solo posed portraits. Use Couple Portraits when a couple are the clear focus. Use Groups & Family for posed groups, families, bridal parties, friends and group portraits. Use Guests & Candids for reactions, mingling, laughter, audience, documentary moments and live-event atmosphere. Use Speeches & Toasts for microphones, toasts, speeches and speakers. Use Reception & Party for dinner, food, cake cutting, birthdays, dancefloor, DJ and celebration scenes. Use First Dance only for a couple's first dance. Use Graduation when caps, gowns, diplomas, campus portraits or graduate celebration are the clear subject. Use Baby Shower for pregnancy celebration, gender reveal, baby shower games and baby shower moments. Use Baby & Family for newborns, babies, baby milestones, parent-child portraits and family-at-home moments. If uncertain, use Unsorted. Return only JSON.`;
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
          category: { type: "string", enum: DELIVERY_CATEGORIES.filter(category => !["Films", "Documents"].includes(category)) }
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
    const category = DELIVERY_CATEGORIES.find(item => text.toLowerCase().includes(item.toLowerCase()));
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
  const mapped = LEGACY_CATEGORY_MAP[requested] || requested;
  if (DELIVERY_CATEGORIES.includes(mapped)) return mapped;
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

const ZIP_MAX_32 = 0xffffffffn;
const ZIP_UTF8_WITH_DESCRIPTOR = 0x0808;
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32Update(crc, bytes) {
  let next = crc >>> 0;
  for (const byte of bytes) {
    next = CRC32_TABLE[(next ^ byte) & 0xff] ^ (next >>> 8);
  }
  return next >>> 0;
}

function cleanZipPathPart(value) {
  return cleanFileName(value).replace(/^\.+$/, "Files");
}

function uniqueZipEntryName(name, used) {
  const safe = String(name || "file").replace(/^\/+/, "").replace(/\/+/g, "/");
  const dot = safe.lastIndexOf(".");
  const slash = safe.lastIndexOf("/");
  const base = dot > slash ? safe.slice(0, dot) : safe;
  const extension = dot > slash ? safe.slice(dot) : "";
  const key = safe.toLowerCase();
  const count = (used.get(key) || 0) + 1;
  used.set(key, count);
  if (count === 1) return safe;
  const candidate = `${base}-${count}${extension}`;
  used.set(candidate.toLowerCase(), 1);
  return candidate;
}

function dosDateTime(value) {
  const date = new Date(value);
  const safe = Number.isFinite(date.getTime()) ? date : new Date();
  const year = Math.max(1980, safe.getUTCFullYear());
  const month = safe.getUTCMonth() + 1;
  const day = safe.getUTCDate();
  const hours = safe.getUTCHours();
  const minutes = safe.getUTCMinutes();
  const seconds = Math.floor(safe.getUTCSeconds() / 2);
  return {
    time: ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f),
    date: (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f)
  };
}

function zipEntryNeedsZip64(entry) {
  return entry.size > ZIP_MAX_32 || entry.compressedSize > ZIP_MAX_32 || entry.offset > ZIP_MAX_32;
}

function zipLocalHeader(nameBytes, dos, zip64File) {
  return concatBytes([
    u32(0x04034b50),
    u16(zip64File ? 45 : 20),
    u16(ZIP_UTF8_WITH_DESCRIPTOR),
    u16(0),
    u16(dos.time),
    u16(dos.date),
    u32(0),
    u32(0),
    u32(0),
    u16(nameBytes.length),
    u16(0),
    nameBytes
  ]);
}

function zipDataDescriptor(crc, size, zip64File) {
  return zip64File
    ? concatBytes([u32(0x08074b50), u32(crc), u64(size), u64(size)])
    : concatBytes([u32(0x08074b50), u32(crc), u32(Number(size)), u32(Number(size))]);
}

function zipCentralHeader(entry) {
  const needsZip64 = zipEntryNeedsZip64(entry);
  const extraParts = [];
  if (needsZip64) {
    const zip64Values = [];
    if (entry.size > ZIP_MAX_32 || entry.compressedSize > ZIP_MAX_32) {
      zip64Values.push(u64(entry.size), u64(entry.compressedSize));
    }
    if (entry.offset > ZIP_MAX_32) zip64Values.push(u64(entry.offset));
    const extraBody = concatBytes(zip64Values);
    extraParts.push(u16(0x0001), u16(extraBody.length), extraBody);
  }
  const extra = concatBytes(extraParts);
  return concatBytes([
    u32(0x02014b50),
    u16(needsZip64 ? 45 : 20),
    u16(needsZip64 ? 45 : 20),
    u16(ZIP_UTF8_WITH_DESCRIPTOR),
    u16(0),
    u16(entry.dos.time),
    u16(entry.dos.date),
    u32(entry.crc),
    u32(entry.compressedSize > ZIP_MAX_32 ? 0xffffffff : Number(entry.compressedSize)),
    u32(entry.size > ZIP_MAX_32 ? 0xffffffff : Number(entry.size)),
    u16(entry.nameBytes.length),
    u16(extra.length),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(entry.offset > ZIP_MAX_32 ? 0xffffffff : Number(entry.offset)),
    entry.nameBytes,
    extra
  ]);
}

function zip64EndOfCentralDirectory(entryCount, centralSize, centralOffset) {
  return concatBytes([
    u32(0x06064b50),
    u64(44n),
    u16(45),
    u16(45),
    u32(0),
    u32(0),
    u64(BigInt(entryCount)),
    u64(BigInt(entryCount)),
    u64(centralSize),
    u64(centralOffset)
  ]);
}

function zip64EndOfCentralDirectoryLocator(zip64EocdOffset) {
  return concatBytes([
    u32(0x07064b50),
    u32(0),
    u64(zip64EocdOffset),
    u32(1)
  ]);
}

function zipEndOfCentralDirectory(entryCount, centralSize, centralOffset) {
  return concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(Math.min(entryCount, 0xffff)),
    u16(Math.min(entryCount, 0xffff)),
    u32(centralSize > ZIP_MAX_32 ? 0xffffffff : Number(centralSize)),
    u32(centralOffset > ZIP_MAX_32 ? 0xffffffff : Number(centralOffset)),
    u16(0)
  ]);
}

function u16(value) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, Number(value), true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Number(value), true);
  return bytes;
}

function u64(value) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return bytes;
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
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
