import { RequestBodyTooLargeError } from "./errors";

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
	const contentLength = Number(request.headers.get("content-length") ?? 0);
	if (contentLength > maxBytes) throw new RequestBodyTooLargeError("Request body is too large");

	const reader = request.body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	if (reader) {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > maxBytes) {
					await reader.cancel();
					throw new RequestBodyTooLargeError("Request body is too large");
				}
				chunks.push(value);
			}
		} finally { reader.releaseLock(); }
	}
	const body = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
	if (body.byteLength === 0) return {} as T;

	return JSON.parse(new TextDecoder().decode(body)) as T;
}

export function assertRequestSize(request: Request, maxBytes: number): void {
	const contentLength = Number(request.headers.get("content-length") ?? 0);
	if (contentLength > maxBytes) throw new RequestBodyTooLargeError("Request body is too large");
}

export async function readFormDataBody(request: Request, maxBytes: number): Promise<FormData> {
	assertRequestSize(request, maxBytes);
	const body = await request.arrayBuffer();
	if (body.byteLength > maxBytes) throw new RequestBodyTooLargeError("Request body is too large");

	return new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body,
	}).formData();
}
