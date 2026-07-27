import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				stage: 'index.html',
				control: 'control.html',
			},
		},
	},
})
