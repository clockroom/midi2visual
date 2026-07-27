export function normalizePublicFileName(
	value: string,
	defaultFileName: string,
	defaultExtension: string,
): string {
	const trimmed = value.trim()
	const lastSegment = trimmed.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] ?? ''
	const fileName = lastSegment || defaultFileName

	if (/\.[^.]+$/.test(fileName)) {
		return fileName
	}

	return `${fileName}${defaultExtension}`
}

export function toPublicFileUrl(fileName: string): string {
	return `/${encodeURIComponent(fileName)}`
}
