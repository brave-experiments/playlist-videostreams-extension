import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript'
import autoprefixer from 'autoprefixer'
import postcss from 'rollup-plugin-postcss'
import postcssNested from 'postcss-nested'

export default {
    input: {
      popup: 'popup/index.tsx',
      background: 'background.js'
    },
    output:
        {
            dir: 'bundle',
            format: 'esm',
            sourcemap: true,
            manualChunks: {}
        }
    ,
    plugins: [
        resolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json' }),
        replace({
          preventAssignment: false,
          'process.env.NODE_ENV': '"development"'
        }),
        postcss({
          plugins: [autoprefixer(), postcssNested()],
          extract: true
        }),
    ]
}