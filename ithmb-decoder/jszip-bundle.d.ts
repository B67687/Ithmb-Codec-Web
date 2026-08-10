// Types bridge for the browser-bundled jszip module. The browser cannot
// resolve the bare "jszip" specifier (native ESM has no node_modules
// resolution), so build.mjs bundles it once into jszip-bundle.js and
// download.ts imports that. This file forwards jszip's real types so the
// import stays fully typed.
export { default } from "jszip";
