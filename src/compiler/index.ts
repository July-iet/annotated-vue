import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'
import { CompilerOptions, CompiledResult } from 'types/compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 编译器
export const createCompiler = createCompilerCreator(function baseCompile(
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 1、模板解析：用正则等方式解析 template 模板中的指令、class、style 等数据，形成 AST
  const ast = parse(template.trim(), options)
  // 2、优化阶段：遍历 AST，标记其中的静态节点
  // 在 patch 时可以跳过静态节点，优化性能
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 3、代码生成：将 AST 转化成渲染函数
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,  // render 函数
    staticRenderFns: code.staticRenderFns
  }
})
