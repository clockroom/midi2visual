import * as THREE from 'three'

export interface DistanceVisibilityUniform {
	value: number
}

export function applyDistanceVisibility(
	material: THREE.Material,
	uniform: DistanceVisibilityUniform,
): void {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.distanceVisibility = uniform
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <fog_pars_fragment>',
				[
					'#include <fog_pars_fragment>',
					'uniform float distanceVisibility;',
				].join('\n'),
			)
			.replace(
				'#include <fog_fragment>',
				[
					'vec3 colorBeforeFog = gl_FragColor.rgb;',
					'#include <fog_fragment>',
					'gl_FragColor.rgb = mix(',
					'\tgl_FragColor.rgb,',
					'\tcolorBeforeFog,',
					'\tclamp(distanceVisibility, 0.0, 1.0)',
					');',
				].join('\n'),
			)
	}
	material.customProgramCacheKey = () =>
		`midi2visual-distance-visibility-v1:${material.type}`
}
