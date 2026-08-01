import * as THREE from 'three'

export async function loadEffectTexture(
	loader: THREE.TextureLoader,
	url: string,
): Promise<THREE.Texture> {
	const texture = await loader.loadAsync(url)
	texture.colorSpace = THREE.SRGBColorSpace
	texture.minFilter = THREE.LinearMipmapLinearFilter
	texture.magFilter = THREE.LinearFilter
	texture.generateMipmaps = true
	return texture
}
