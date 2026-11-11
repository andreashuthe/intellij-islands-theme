// Generates themes/islands-{dark,light}-color-theme.json from the IntelliJ sources in ./jetbrains.
//   node scripts/build.js
const fs = require('fs');
const path = require('path');
const scheme = require('./scheme');
const uiTheme = require('./ui');

const OUT = path.join(__dirname, '..', 'themes');

/** "#RRGGBB" + alpha (0..1) → "#RRGGBBAA" */
const alpha = (c, a) => (c ? c.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase() : c);

/**
 * Makes rules language specific by appending the grammar's scope suffix to every part of a selector
 * ("meta.function-call entity.name.function" → "meta.function-call.ts entity.name.function.ts").
 * Suffixes instead of a root prefix ("source.ts …"): vscode-textmate ranks equally deep selectors by the length of
 * their parent scope names, so a long root prefix would beat a more specific rule.
 */
const suffixed = suffixes => rules =>
  rules.map(([name, scopes, key]) => [name, suffixes.flatMap(sfx => scopes.map(sc => sc.split(' ').map(part => `${part}.${sfx}`).join(' '))), key]);
const js = suffixed(['js', 'ts', 'tsx', 'js.jsx']);
/** Root-scoped rules where the grammars' scope names don't share a common suffix pattern. */
const rooted = roots => rules => rules.map(([name, scopes, key]) => [name, roots.flatMap(r => scopes.map(sc => `${r} ${sc}`)), key]);
const css = rooted(['source.css', 'source.css.scss', 'source.css.less', 'source.sass']);
const php = rooted(['source.php']);
const html = rooted(['text.html.basic', 'text.html.derivative']);

// ---------------------------------------------------------------------------------------------
// TextMate scopes → IntelliJ text attribute keys. Order matters only for equally specific selectors
// (later wins), so generic rules come first and language specific ones after them.
// ---------------------------------------------------------------------------------------------
const TOKENS = [
  // -- generic ---------------------------------------------------------------------------------
  ['Text', ['source', 'text', 'variable', 'variable.other', 'meta.embedded', 'punctuation', 'meta.brace', 'meta.delimiter'], 'TEXT'],
  ['Line comment', ['comment', 'punctuation.definition.comment'], 'DEFAULT_LINE_COMMENT'],
  ['Block comment', ['comment.block', 'comment.block punctuation.definition.comment'], 'DEFAULT_BLOCK_COMMENT'],
  ['Doc comment', ['comment.block.documentation', 'comment.block.javadoc', 'comment.block.documentation punctuation.definition.comment', 'comment.block.javadoc punctuation.definition.comment', 'comment.documentation'], 'DEFAULT_DOC_COMMENT'],
  ['Doc comment tag', ['keyword.other.documentation', 'comment.block.documentation keyword', 'comment.block.documentation storage.type', 'comment.block.documentation punctuation.definition.block.tag', 'comment.block.documentation punctuation.definition.inline.tag', 'storage.type.class.jsdoc', 'punctuation.definition.block.tag.jsdoc'], 'DEFAULT_DOC_COMMENT_TAG'],
  ['Doc comment tag value', ['comment.block.documentation variable.other', 'comment.block.documentation entity.name.type', 'variable.other.jsdoc', 'entity.name.type.instance.jsdoc'], 'DEFAULT_DOC_COMMENT_TAG_VALUE'],
  ['Doc comment markup', ['comment.block.documentation markup', 'comment.block.documentation entity.name.tag', 'comment.block.javadoc entity.name.tag'], 'DEFAULT_DOC_MARKUP'],
  ['String', ['string', 'punctuation.definition.string', 'string.template', 'string.quoted', 'string.unquoted.heredoc'], 'DEFAULT_STRING'],
  ['String escape', ['constant.character.escape', 'constant.other.placeholder', 'constant.character.format.placeholder', 'string punctuation.definition.template-expression', 'punctuation.section.embedded'], 'DEFAULT_VALID_STRING_ESCAPE'],
  ['Number', ['constant.numeric', 'keyword.other.unit', 'constant.numeric keyword.other.unit'], 'DEFAULT_NUMBER'],
  ['Keyword', ['keyword', 'keyword.control', 'keyword.other', 'storage', 'storage.type', 'storage.modifier', 'constant.language', 'variable.language', 'support.type.primitive', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.instanceof', 'keyword.operator.word', 'keyword.operator.logical.python', 'keyword.operator.sizeof', 'keyword.operator.typeof', 'keyword.operator.delete', 'keyword.operator.in', 'keyword.operator.of', 'keyword.operator.void', 'keyword.operator.cast', 'keyword.operator.is', 'keyword.operator.as'], 'DEFAULT_KEYWORD'],
  ['Operator', ['keyword.operator', 'punctuation.accessor', 'punctuation.separator', 'punctuation.terminator', 'keyword.control.ternary', 'punctuation.definition.parameters', 'punctuation.definition.arguments', 'punctuation.section', 'meta.brace.round', 'meta.brace.square', 'meta.brace.curly'], 'DEFAULT_OPERATION_SIGN'],
  ['Function declaration', ['entity.name.function', 'meta.definition.method entity.name.function', 'meta.function entity.name.function', 'entity.name.function.constructor'], 'DEFAULT_FUNCTION_DECLARATION'],
  ['Function call', ['meta.function-call entity.name.function', 'meta.method-call entity.name.function', 'meta.function-call.generic', 'meta.function-call support.function', 'meta.function-call.python support.function', 'support.function', 'variable.function'], 'DEFAULT_FUNCTION_CALL'],
  ['Class / type', ['entity.name.type', 'entity.name.class', 'entity.name.namespace', 'entity.other.inherited-class', 'support.class', 'support.type', 'entity.name.type.module', 'storage.type.java', 'storage.type.object.array.java', 'storage.type.groovy', 'meta.type.annotation entity.name.type', 'entity.name.type.class', 'entity.name.type.interface', 'entity.name.type.enum'], 'DEFAULT_CLASS_NAME'],
  ['Type parameter', ['entity.name.type.parameter', 'storage.type.generic', 'storage.type.generic.java', 'meta.type.parameters entity.name.type', 'entity.name.type.type-parameter'], 'TYPE_PARAMETER_NAME_ATTRIBUTES'],
  ['Parameter', ['variable.parameter', 'meta.parameter variable', 'entity.name.variable.parameter'], 'DEFAULT_PARAMETER'],
  ['Local variable', ['variable.other.readwrite', 'variable.other.local', 'variable.other.object', 'entity.name.variable', 'variable.other.definition'], 'DEFAULT_LOCAL_VARIABLE'],
  ['Field / property', ['variable.other.property', 'variable.other.object.property', 'variable.other.member', 'meta.property.object', 'support.variable.property', 'meta.definition.property entity.name', 'variable.object.property', 'entity.name.variable.field', 'meta.class.body.java meta.definition.variable.java variable.other.definition.java'], 'DEFAULT_INSTANCE_FIELD'],
  ['Constant', ['variable.other.constant', 'constant.other', 'support.constant', 'variable.other.enummember', 'entity.name.constant', 'constant.other.enum', 'variable.other.constant.property'], 'DEFAULT_CONSTANT'],
  ['Annotation / decorator', ['storage.type.annotation', 'punctuation.definition.annotation', 'punctuation.decorator', 'entity.name.function.decorator', 'meta.decorator entity.name.function', 'meta.decorator meta.function-call entity.name.function', 'meta.declaration.annotation storage.type.annotation', 'entity.name.function.annotation', 'meta.annotation.identifier', 'support.type.attribute'], 'DEFAULT_METADATA'],
  ['Regular expression', ['string.regexp', 'string.regexp constant', 'string.regexp keyword', 'string.regexp punctuation', 'string.regexp keyword.other', 'string.regexp constant.other.character-class', 'string.regexp punctuation.definition.string'], 'JS.REGEXP'],
  ['Label', ['entity.name.label', 'punctuation.definition.label'], 'DEFAULT_LABEL'],
  ['Invalid', ['invalid', 'invalid.illegal'], 'WRONG_REFERENCES_ATTRIBUTES'],
  ['Deprecated', ['invalid.deprecated'], 'DEPRECATED_ATTRIBUTES'],

  // -- XML / HTML -----------------------------------------------------------------------------
  ['XML tag', ['entity.name.tag', 'punctuation.definition.tag', 'meta.tag', 'meta.tag.preprocessor.xml', 'punctuation.definition.tag.xml'], 'XML_TAG_NAME'],
  ['XML attribute', ['entity.other.attribute-name', 'meta.attribute-with-value entity.other.attribute-name'], 'XML_ATTRIBUTE_NAME'],
  ['XML attribute value', ['meta.tag string.quoted', 'meta.tag string.quoted punctuation.definition.string', 'string.quoted.double.xml', 'string.quoted.single.xml'], 'XML_ATTRIBUTE_VALUE'],
  ['XML entity', ['constant.character.entity', 'punctuation.definition.entity', 'constant.character.entity.xml'], 'XML_ENTITY_REFERENCE'],
  ['XML prolog', ['meta.tag.preprocessor.xml entity.name.tag', 'meta.tag.sgml.doctype', 'meta.tag.metadata.doctype'], 'XML_PROLOGUE'],
  ['XML text', ['text.xml', 'text.html', 'meta.tag.xml text'], 'TEXT'],

  // -- JSON / YAML / properties / TOML ---------------------------------------------------------
  ['JSON key', ['support.type.property-name.json', 'support.type.property-name.json punctuation.support.type.property-name', 'meta.object-literal.key.json', 'support.type.property-name.jsonc'], 'JSON_PROPERTY_KEY'],
  ['JSON keyword', ['constant.language.json'], 'DEFAULT_KEYWORD'],
  ['YAML key', ['entity.name.tag.yaml', 'meta.mapping.key.yaml string', 'support.type.property-name.toml', 'meta.key.toml', 'support.type.property-name.table.toml'], 'YAML_SCALAR_KEY'],
  ['YAML value', ['string.unquoted.plain.out.yaml', 'string.unquoted.plain.in.yaml', 'string.unquoted.block.yaml'], 'TEXT'],
  ['YAML anchor', ['entity.name.type.anchor.yaml', 'variable.other.alias.yaml', 'punctuation.definition.anchor.yaml', 'punctuation.definition.alias.yaml'], 'DEFAULT_IDENTIFIER'],
  ['Properties key', ['keyword.other.definition.ini', 'support.type.property-name.properties', 'entity.name.tag.properties', 'variable.other.key.properties'], 'PROPERTIES.KEY'],
  ['Properties value', ['string.unquoted.ini', 'string.unquoted.properties', 'string.unquoted.value.properties'], 'PROPERTIES.VALUE'],
  ['INI section', ['entity.name.section.group-title.ini'], 'DEFAULT_KEYWORD'],

  // -- Markdown -------------------------------------------------------------------------------
  ['Markdown heading', ['markup.heading', 'markup.heading entity.name', 'entity.name.section.markdown', 'heading.1.markdown', 'heading.2.markdown', 'heading.3.markdown'], 'MARKDOWN_HEADER_LEVEL_1'],
  ['Markdown heading marker', ['punctuation.definition.heading.markdown', 'markup.heading punctuation.definition.heading'], 'MARKDOWN_HEADER_MARKER'],
  ['Markdown bold', ['markup.bold'], 'MARKDOWN_BOLD'],
  ['Markdown italic', ['markup.italic'], 'MARKDOWN_ITALIC'],
  ['Markdown emphasis marker', ['punctuation.definition.bold.markdown', 'punctuation.definition.italic.markdown'], 'MARKDOWN_BOLD_MARKER'],
  ['Markdown strikethrough', ['markup.strikethrough'], 'MARKDOWN_STRIKE_THROUGH'],
  ['Markdown code', ['markup.inline.raw', 'markup.raw', 'markup.fenced_code.block.markdown', 'markup.inline.raw.string.markdown'], 'MARKDOWN_CODE_SPAN'],
  ['Markdown code marker', ['punctuation.definition.markdown', 'punctuation.definition.raw.markdown', 'markup.fenced_code.block.markdown punctuation.definition'], 'MARKDOWN_CODE_FENCE_MARKER'],
  ['Markdown fence language', ['fenced_code.block.language', 'fenced_code.block.language.markdown'], 'MARKDOWN_CODE_FENCE_LANGUAGE'],
  ['Markdown list marker', ['punctuation.definition.list.begin.markdown', 'beginning.punctuation.definition.list.markdown'], 'MARKDOWN_LIST_MARKER'],
  ['Markdown quote', ['markup.quote', 'punctuation.definition.quote.begin.markdown'], 'MARKDOWN_BLOCK_QUOTE_MARKER'],
  ['Markdown link text', ['string.other.link.title.markdown', 'string.other.link.description.markdown', 'meta.link.inline.markdown string.other.link'], 'MARKDOWN_LINK_TEXT'],
  ['Markdown link destination', ['markup.underline.link', 'markup.underline.link.markdown', 'markup.underline.link.image.markdown'], 'MARKDOWN_LINK_DESTINATION'],
  ['Markdown separator', ['meta.separator.markdown', 'punctuation.definition.table.markdown'], 'MARKDOWN_HRULE'],

  // -- Java (VS Code's built-in grammar) ------------------------------------------------------
  ['Java package', ['storage.modifier.package.java', 'storage.modifier.import.java', 'storage.modifier.package.java punctuation.separator.java', 'storage.modifier.import.java punctuation.separator.java'], 'TEXT'],
  ['Java keyword-like types', ['storage.type.primitive.java', 'storage.type.primitive.array.java', 'variable.language.this.java', 'variable.language.super.java', 'keyword.control.new.java', 'storage.type.var.java'], 'JAVA_KEYWORD'],
  ['Java method declaration', ['meta.method.identifier.java entity.name.function.java', 'meta.constructor.identifier.java entity.name.function.java'], 'METHOD_DECLARATION_ATTRIBUTES'],
  ['Java method call', ['meta.method-call.java entity.name.function.java', 'meta.function-call.java entity.name.function.java'], 'METHOD_CALL_ATTRIBUTES'],
  ['Java local variable', ['meta.method.body.java meta.definition.variable.java variable.other.definition.java', 'meta.method.body.java variable.other.definition.java', 'variable.other.object.java'], 'LOCAL_VARIABLE_ATTRIBUTES'],
  ['Java field access', ['variable.other.object.property.java'], 'INSTANCE_FIELD_ATTRIBUTES'],
  ['Java annotation', ['meta.declaration.annotation.java storage.type.annotation.java', 'meta.declaration.annotation.java punctuation.definition.annotation.java', 'storage.type.annotation.java'], 'ANNOTATION_NAME_ATTRIBUTES'],
  ['Java annotation parameter', ['meta.declaration.annotation.java variable.other.annotation-element.java', 'variable.other.annotation-element.java'], 'ANNOTATION_ATTRIBUTE_NAME_ATTRIBUTES'],
  ['Java class name', ['entity.name.type.class.java', 'entity.name.type.interface.java', 'entity.name.type.enum.java', 'entity.name.type.record.java', 'entity.other.inherited-class.java'], 'CLASS_NAME_ATTRIBUTES'],
  ['Java enum constant', ['constant.other.enum.java'], 'STATIC_FINAL_FIELD_ATTRIBUTES'],

  // -- Kotlin (JetBrains' grammar and fwcd's) -------------------------------------------------
  ['Kotlin keyword', ['storage.type.kotlin', 'storage.modifier.kotlin', 'keyword.control.kotlin', 'constant.language.kotlin', 'keyword.hard.kotlin', 'keyword.soft.kotlin', 'storage.type.function.kotlin', 'storage.type.class.kotlin'], 'KOTLIN_KEYWORD'],
  ['Kotlin type', ['support.type.kotlin', 'entity.name.type.kotlin', 'entity.name.type.class.kotlin'], 'KOTLIN_CLASS'],
  ['Kotlin function declaration', ['entity.name.function.kotlin', 'entity.name.function.declaration.kotlin'], 'KOTLIN_FUNCTION_DECLARATION'],
  ['Kotlin function call', ['entity.name.function.call.kotlin', 'meta.function-call.kotlin entity.name.function'], 'KOTLIN_FUNCTION_CALL'],
  ['Kotlin variable', ['variable.other.readwrite.kotlin', 'entity.name.variable.kotlin'], 'KOTLIN_LOCAL_VARIABLE'],
  ['Kotlin annotation', ['meta.annotation.kotlin', 'entity.name.function.annotation.kotlin', 'punctuation.definition.annotation.kotlin', 'entity.name.type.annotation.kotlin'], 'KOTLIN_ANNOTATION'],
  ['Kotlin string template', ['variable.other.interpolated.kotlin', 'variable.other.interpolated.expression.kotlin', 'variable.string-escape.kotlin'], 'TEXT'],
  ['Kotlin string template entry', ['punctuation.definition.template-expression.begin.kotlin', 'punctuation.definition.template-expression.end.kotlin', 'punctuation.section.embedded.begin.kotlin', 'punctuation.section.embedded.end.kotlin'], 'KOTLIN_STRING_ESCAPE'],
  ['Kotlin label', ['entity.name.label.kotlin', 'storage.modifier.label.kotlin'], 'KOTLIN_LABEL'],

  // -- Python (VS Code's MagicPython grammar) -------------------------------------------------
  ['Python docstring', ['string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string', 'string.quoted.docstring.multi.python', 'string.quoted.docstring.single.python'], 'PY.DOC_COMMENT'],
  ['Python self / cls', ['variable.language.special.self.python', 'variable.parameter.function.language.special.self.python', 'variable.language.special.cls.python', 'variable.parameter.function.language.special.cls.python'], 'PY.SELF_PARAMETER'],
  ['Python builtins', ['support.function.builtin.python', 'support.type.python', 'support.type.exception.python', 'support.variable.builtin.python'], 'PY.BUILTIN_NAME'],
  ['Python magic names', ['support.function.magic.python', 'support.variable.magic.python', 'meta.function.python support.function.magic.python'], 'PY.PREDEFINED_USAGE'],
  ['Python keyword argument', ['variable.parameter.function-call.python'], 'PY.KEYWORD_ARGUMENT'],
  ['Python decorator', ['meta.function.decorator.python', 'entity.name.function.decorator.python', 'punctuation.definition.decorator.python', 'meta.function.decorator.python support.type.python', 'meta.function.decorator.python meta.function-call.python'], 'PY.DECORATOR'],
  ['Python attribute / constant', ['meta.attribute.python', 'meta.member.access.python', 'constant.other.caps.python', 'variable.other.constant.python'], 'TEXT'],
  ['Python string prefix', ['storage.type.string.python'], 'PY.STRING.U'],
  ['Python f-string braces', ['constant.character.format.placeholder.other.python', 'meta.fstring.python constant.character.format.placeholder.other.python', 'storage.type.format.python'], 'PY.FSTRING_FRAGMENT_BRACES'],
  ['Python function declaration', ['entity.name.function.python', 'meta.function.python entity.name.function.python'], 'PY.FUNC_DEFINITION'],
  ['Python call', ['meta.function-call.generic.python', 'meta.function-call.python entity.name.function'], 'PY.FUNCTION_CALL'],
  ['Python class', ['entity.name.type.class.python', 'entity.other.inherited-class.python'], 'PY.CLASS_DEFINITION'],
  ['Python parameter', ['variable.parameter.function.language.python'], 'PY.PARAMETER'],

  // -- JavaScript / TypeScript (VS Code's TypeScript grammars; semantic tokens refine this) ----
  ...js([
    ['JS global variable', ['variable.other.constant', 'meta.definition.variable variable.other.readwrite', 'support.class.console', 'support.variable.dom', 'support.constant.math', 'support.class.builtin', 'support.variable.object.process', 'support.variable.object.node', 'support.variable.property.importmeta'], 'JS.GLOBAL_VARIABLE'],
    ['JS local variable', ['variable.other.readwrite', 'meta.block meta.definition.variable variable.other.constant', 'meta.block meta.definition.variable variable.other.readwrite', 'meta.arrow meta.definition.variable variable.other.constant'], 'JS.LOCAL_VARIABLE'],
    ['JS parameter', ['variable.parameter', 'meta.parameters variable.parameter'], 'JS.PARAMETER'],
    ['JS property', ['variable.other.property', 'variable.other.object.property', 'variable.object.property', 'meta.object-literal.key', 'variable.other.constant.property', 'support.variable.property', 'meta.definition.property variable.object.property'], 'JS.INSTANCE_MEMBER_VARIABLE'],
    ['JS function', ['entity.name.function', 'meta.definition.function entity.name.function', 'meta.function-call entity.name.function', 'support.function'], 'JS.GLOBAL_FUNCTION'],
    ['JS method', ['meta.definition.method entity.name.function', 'meta.method.declaration entity.name.function', 'meta.function-call support.function.dom', 'support.function.console'], 'JS.INSTANCE_MEMBER_FUNCTION'],
    ['JS class', ['entity.name.type', 'entity.name.type.class', 'entity.other.inherited-class', 'support.class', 'new.expr entity.name.type', 'new.expr entity.name.function', 'new.expr meta.function-call entity.name.function'], 'JS.CLASS'],
    ['JS import', ['meta.import variable.other.readwrite', 'meta.import variable.other.readwrite.alias', 'meta.export variable.other.readwrite', 'meta.import entity.name.type'], 'TEXT'],
    ['JS interface / type alias', ['entity.name.type.interface', 'entity.name.type.alias', 'entity.name.type.enum'], 'JS.INTERFACE'],
    ['TS type parameter', ['meta.type.parameters entity.name.type', 'entity.name.type.type-parameter'], 'TS.TYPE_PARAMETER'],
    ['JS primitive type', ['support.type.primitive', 'support.type.builtin'], 'JS.PRIMITIVE_TYPE'],
    ['JS decorator', ['meta.decorator punctuation.decorator', 'meta.decorator entity.name.function', 'meta.decorator meta.function-call entity.name.function', 'meta.decorator variable.other.readwrite'], 'JS.DECORATOR'],
    ['JS arrow', ['storage.type.function.arrow'], 'JS.FUNCTION_ARROW'],
    ['JS template placeholder', ['punctuation.definition.template-expression.begin', 'punctuation.definition.template-expression.end'], 'JS.TEMPLATE_LITERAL_PLACEHOLDER_DELIMITERS'],
    ['JS enum member', ['variable.other.enummember'], 'JS.STATIC_MEMBER_VARIABLE'],
    ['JSX component', ['support.class.component'], 'JS.JSX_CLIENT_COMPONENT'],
  ]),

  // -- CSS / SCSS / Less ---------------------------------------------------------------------
  ...css([
    ['CSS selector', ['entity.other.attribute-name.class', 'entity.other.attribute-name.id', 'entity.other.attribute-name.pseudo-class', 'entity.other.attribute-name.pseudo-element', 'entity.other.attribute-name.parent-selector', 'meta.attribute-selector entity.other.attribute-name', 'meta.selector punctuation.definition.entity', 'entity.other.attribute-name'], 'CSS.IDENT'],
    ['CSS tag', ['entity.name.tag', 'entity.name.tag.wildcard', 'entity.name.tag.reference'], 'CSS.TAG_NAME'],
    ['CSS property', ['support.type.property-name', 'support.type.vendored.property-name', 'meta.property-name', 'variable.css', 'variable.argument.css', 'support.type.custom-property', 'variable.scss', 'variable.other.less'], 'CSS.PROPERTY_NAME'],
    ['CSS value', ['support.constant.property-value', 'support.constant.font-name', 'support.constant.vendored', 'support.constant.media', 'support.constant.color', 'meta.property-value support.constant', 'keyword.other.unicode-range'], 'CSS.PROPERTY_VALUE'],
    ['CSS color', ['constant.other.color.rgb-value', 'constant.other.color.rgb-value punctuation.definition.constant', 'constant.other.rgb-value'], 'CSS.COLOR'],
    ['CSS important', ['keyword.other.important'], 'CSS.IMPORTANT'],
    ['CSS function', ['support.function', 'support.function.misc', 'support.function.url', 'support.function.transform', 'support.function.calc', 'support.function.gradient', 'support.function.timing-function', 'support.function.var'], 'CSS.FUNCTION'],
    ['CSS url', ['meta.function.url string', 'variable.parameter.url'], 'CSS.URL'],
    ['CSS at-rule', ['keyword.control.at-rule', 'keyword.control.at-rule punctuation.definition.keyword', 'keyword.control'], 'CSS.KEYWORD'],
    ['CSS number', ['constant.numeric', 'keyword.other.unit'], 'CSS.NUMBER'],
  ]),

  // -- HTML ------------------------------------------------------------------------------------
  ...html([
    ['HTML tag', ['entity.name.tag', 'punctuation.definition.tag', 'meta.tag punctuation.definition.tag'], 'HTML_TAG_NAME'],
    ['HTML custom tag', ['entity.name.tag.custom'], 'HTML_CUSTOM_TAG_NAME'],
    ['HTML attribute', ['entity.other.attribute-name', 'meta.attribute entity.other.attribute-name'], 'HTML_ATTRIBUTE_NAME'],
    ['HTML attribute value', ['meta.attribute string.quoted', 'meta.attribute string.quoted punctuation.definition.string', 'meta.tag string.quoted'], 'HTML_ATTRIBUTE_VALUE'],
    ['HTML entity', ['constant.character.entity', 'constant.character.entity punctuation.definition.entity'], 'HTML_ENTITY_REFERENCE'],
    ['HTML comment', ['comment.block', 'comment.block punctuation.definition.comment'], 'HTML_COMMENT'],
  ]),
  ['HTML text', ['text.html.basic', 'text.html.derivative'], 'TEXT'],

  // -- PHP (approximation: PhpStorm's attributes are not open source) -------------------------
  ...php([
    ['PHP variable', ['variable.other', 'variable.other punctuation.definition.variable', 'variable.parameter', 'punctuation.definition.variable'], 'PHP.VARIABLE'],
    ['PHP constant', ['constant.other', 'constant.other.class', 'variable.other.constant'], 'PHP.CONSTANT'],
    ['PHP keywords', ['support.function.construct', 'keyword.other.type', 'storage.type'], 'DEFAULT_KEYWORD'],
    ['PHP property', ['variable.other.property'], 'DEFAULT_INSTANCE_FIELD'],
    ['PHP class', ['support.class', 'entity.name.type', 'entity.other.inherited-class', 'support.other.namespace', 'entity.name.type.namespace'], 'DEFAULT_CLASS_NAME'],
    ['PHP call', ['meta.function-call entity.name.function', 'meta.method-call entity.name.function', 'support.function'], 'DEFAULT_FUNCTION_CALL'],
  ]),
  ['PHP tag', ['punctuation.section.embedded.begin.php', 'punctuation.section.embedded.end.php', 'punctuation.section.embedded.begin.php source.php', 'punctuation.section.embedded.end.php source.php'], 'PHP.TAG'],

  // -- C / C++ (approximation: CLion's attributes are not open source) ------------------------
  ['C++ preprocessor', ['meta.preprocessor', 'keyword.control.directive', 'punctuation.definition.directive', 'meta.preprocessor keyword.control.directive', 'meta.preprocessor.include'], 'CPP.PREPROCESSOR'],
  ['C++ include path', ['meta.preprocessor.include string', 'string.quoted.other.lt-gt.include', 'string.quoted.double.include'], 'DEFAULT_STRING'],
  ['C++ macro', ['entity.name.function.preprocessor', 'meta.preprocessor.macro entity.name.function', 'entity.name.other.preprocessor.macro'], 'CPP.MACRO'],
  ['C++ call', ['entity.name.function.member', 'entity.name.function.call', 'meta.function-call entity.name.function', 'entity.name.function.member.cpp', 'entity.name.function.call.cpp'], 'DEFAULT_FUNCTION_CALL'],
  ['C++ member init', ['entity.name.function.call.initializer'], 'DEFAULT_INSTANCE_FIELD'],
  ['C++ types', ['entity.name.type.parameter.cpp', 'entity.name.scope-resolution', 'entity.name.namespace', 'entity.name.type.cpp', 'entity.name.type.c'], 'DEFAULT_CLASS_NAME'],
  ['C++ template parameter', ['entity.name.type.template.cpp', 'meta.template.definition entity.name.type.template'], 'TYPE_PARAMETER_NAME_ATTRIBUTES'],

  // -- Rust (VS Code's grammar + intellij-rust attributes) ------------------------------------
  ['Rust lifetime', ['entity.name.type.lifetime.rust', 'punctuation.definition.lifetime.rust'], 'org.rust.LIFETIME'],
  ['Rust macro', ['entity.name.function.macro.rust', 'meta.macro.rust entity.name.function', 'entity.name.function.macro.rules.rust'], 'org.rust.MACRO'],
  ['Rust attribute', ['meta.attribute.rust', 'meta.attribute.rust entity.name.type.rust', 'meta.attribute.rust punctuation', 'meta.attribute.rust keyword.operator'], 'org.rust.ATTRIBUTE'],
  ['Rust primitive type', ['entity.name.type.numeric.rust', 'entity.name.type.primitive.rust'], 'org.rust.PRIMITIVE_TYPE'],
  ['Rust function call', ['meta.function.call.rust entity.name.function.rust'], 'org.rust.FUNCTION_CALL'],
  ['Rust module', ['entity.name.namespace.rust', 'entity.name.type.rust', 'entity.name.type.struct.rust', 'entity.name.type.enum.rust', 'entity.name.type.trait.rust'], 'org.rust.MODULE'],
  ['Rust ? operator', ['keyword.operator.question.rust'], 'org.rust.Q_OPERATOR'],
  ['Rust format argument', ['meta.interpolation.rust', 'punctuation.definition.interpolation.rust'], 'org.rust.FORMAT_PARAMETER'],
  ['Rust doc comment', ['comment.line.documentation.rust', 'comment.block.documentation.rust', 'comment.line.documentation.rust punctuation.definition.comment.rust'], 'org.rust.DOC_COMMENT'],

  // -- Go (VS Code's grammar + GoLand attributes) ---------------------------------------------
  ['Go package', ['entity.name.type.package.go', 'entity.name.package.go'], 'GO_PACKAGE'],
  ['Go type', ['entity.name.type.go'], 'GO_TYPE_REFERENCE'],
  ['Go builtin type', ['storage.type.numeric.go', 'storage.type.string.go', 'storage.type.boolean.go', 'storage.type.error.go', 'storage.type.byte.go', 'storage.type.rune.go', 'storage.type.uintptr.go'], 'GO_BUILTIN_TYPE_REFERENCE'],
  ['Go builtin constant', ['constant.language.go'], 'GO_BUILTIN_CONSTANT'],
  ['Go call', ['entity.name.function.support.go'], 'GO_LOCAL_FUNCTION_CALL'],
  ['Go builtin call', ['entity.name.function.support.builtin.go'], 'GO_BUILTIN_FUNCTION_CALL'],
  ['Go field', ['variable.other.property.go', 'variable.other.property.field.go'], 'GO_STRUCT_FIELD'],
  ['Go constant', ['variable.other.constant.go'], 'GO_PACKAGE_LOCAL_CONSTANT'],
  ['Go format verb', ['constant.other.placeholder.go'], 'GO_VALID_STRING_ESCAPE'],
];

// ---------------------------------------------------------------------------------------------
// Semantic tokens. The JetBrains language server ("Java and Kotlin by IntelliJ IDEA") sends
// class/interface/enum/struct/typeParameter/decorator/parameter/variable/property/enumMember/namespace
// for Java, plus function/method/label/type for Kotlin, with modifiers
// declaration/static/readonly/abstract/deprecated/defaultLibrary/modification.
// ---------------------------------------------------------------------------------------------
const forLanguages = (langs, rules) => langs.flatMap(l => rules.map(([sel, key]) => [`${sel}:${l}`, key]));
const SEMANTIC = [
  ['namespace', 'TEXT'],
  ['class', 'CLASS_NAME_ATTRIBUTES'],
  ['interface', 'INTERFACE_NAME_ATTRIBUTES'],
  ['enum', 'ENUM_NAME_ATTRIBUTES'],
  ['struct', 'RECORD_NAME_ATTRIBUTES'],
  ['type', 'DEFAULT_CLASS_NAME'],
  ['typeParameter', 'TYPE_PARAMETER_NAME_ATTRIBUTES'],
  ['decorator', 'ANNOTATION_NAME_ATTRIBUTES'],
  ['annotation', 'ANNOTATION_NAME_ATTRIBUTES'],
  ['parameter', 'PARAMETER_ATTRIBUTES'],
  ['variable', 'LOCAL_VARIABLE_ATTRIBUTES'],
  ['property', 'INSTANCE_FIELD_ATTRIBUTES'],
  ['property.static', 'STATIC_FIELD_ATTRIBUTES'],
  ['property.static.readonly', 'STATIC_FINAL_FIELD_ATTRIBUTES'],
  ['variable.static', 'STATIC_FIELD_ATTRIBUTES'],
  ['enumMember', 'STATIC_FINAL_FIELD_ATTRIBUTES'],
  ['function', 'METHOD_CALL_ATTRIBUTES'],
  ['method', 'METHOD_CALL_ATTRIBUTES'],
  ['function.declaration', 'METHOD_DECLARATION_ATTRIBUTES'],
  ['method.declaration', 'METHOD_DECLARATION_ATTRIBUTES'],
  ['function.static', 'STATIC_METHOD_ATTRIBUTES'],
  ['method.static', 'STATIC_METHOD_ATTRIBUTES'],
  ['function.static.declaration', 'METHOD_DECLARATION_ATTRIBUTES'],
  ['method.static.declaration', 'METHOD_DECLARATION_ATTRIBUTES'],
  ['keyword', 'DEFAULT_KEYWORD'],
  ['modifier', 'DEFAULT_KEYWORD'],
  ['label', 'KOTLIN_LABEL'],
  ['comment', 'DEFAULT_LINE_COMMENT'],
  ['string', 'DEFAULT_STRING'],
  ['number', 'DEFAULT_NUMBER'],
  ['regexp', 'DEFAULT_STRING'],
  ['operator', 'DEFAULT_OPERATION_SIGN'],
  // Kotlin: package-level functions and constructors, extension functions are italic like in IntelliJ
  ['function.static:kotlin', 'KOTLIN_PACKAGE_FUNCTION_CALL'],
  ['property.static:kotlin', 'KOTLIN_PACKAGE_PROPERTY'],
  // TypeScript / JavaScript (VS Code's built-in TS server): WebStorm colors member *calls* too
  ...forLanguages(['typescript', 'typescriptreact', 'javascript', 'javascriptreact'], [
    ['variable', 'JS.GLOBAL_VARIABLE'],
    ['variable.local', 'JS.LOCAL_VARIABLE'],
    ['variable.defaultLibrary', 'JS.GLOBAL_VARIABLE'],
    ['parameter', 'JS.PARAMETER'],
    ['property', 'JS.INSTANCE_MEMBER_VARIABLE'],
    ['property.static', 'JS.STATIC_MEMBER_VARIABLE'],
    ['method', 'JS.INSTANCE_MEMBER_FUNCTION'],
    ['method.static', 'JS.STATIC_MEMBER_FUNCTION'],
    ['function', 'JS.GLOBAL_FUNCTION'],
    ['function.local', 'JS.LOCAL_FUNCTION'],
    ['class', 'JS.CLASS'],
    ['interface', 'JS.INTERFACE'],
    ['type', 'JS.TYPE_ALIAS'],
    ['enum', 'JS.CLASS'],
    ['enumMember', 'JS.STATIC_MEMBER_VARIABLE'],
    ['typeParameter', 'TS.TYPE_PARAMETER'],
    ['namespace', 'JS.MODULE_NAME'],
  ]),
  // Python (Pylance / basedpyright)
  ...forLanguages(['python'], [
    ['selfParameter', 'PY.SELF_PARAMETER'],
    ['clsParameter', 'PY.SELF_PARAMETER'],
    ['parameter', 'PY.PARAMETER'],
    ['variable', 'PY.LOCAL_VARIABLE'],
    ['property', 'TEXT'], // PyCharm doesn't color attributes
    ['function', 'PY.FUNCTION_CALL'],
    ['method', 'PY.METHOD_CALL'],
    ['function.declaration', 'PY.FUNC_DEFINITION'],
    ['method.declaration', 'PY.FUNC_DEFINITION'],
    ['function.builtin', 'PY.BUILTIN_NAME'],
    ['class.builtin', 'PY.BUILTIN_NAME'],
    ['variable.builtin', 'PY.BUILTIN_NAME'],
    ['function.defaultLibrary', 'PY.FUNCTION_CALL'],
    ['class', 'PY.CLASS_DEFINITION'],
    ['decorator', 'PY.DECORATOR'],
    ['typeParameter', 'PY.TYPE_PARAMETER'],
    ['namespace', 'TEXT'],
    ['module', 'TEXT'],
  ]),
  // Rust (rust-analyzer)
  ...forLanguages(['rust'], [
    ['lifetime', 'org.rust.LIFETIME'],
    ['macro', 'org.rust.MACRO'],
    ['selfKeyword', 'org.rust.SELF_PARAMETER'],
    ['selfTypeKeyword', 'org.rust.SELF_PARAMETER'],
    ['typeParameter', 'org.rust.TYPE_PARAMETER'],
    ['constParameter', 'org.rust.CONSTANT'],
    ['function', 'org.rust.FUNCTION_CALL'],
    ['function.declaration', 'org.rust.FUNCTION'],
    ['method', 'org.rust.METHOD_CALL'],
    ['method.declaration', 'org.rust.METHOD'],
    ['function.associated', 'org.rust.ASSOC_FUNCTION_CALL'],
    ['function.associated.declaration', 'org.rust.ASSOC_FUNCTION'],
    ['method.associated', 'org.rust.METHOD_CALL'],
    ['property', 'org.rust.FIELD'],
    ['enumMember', 'org.rust.ENUM_VARIANT'],
    ['variable', 'org.rust.VARIABLE'],
    ['variable.constant', 'org.rust.CONSTANT'],
    ['variable.static', 'org.rust.STATIC'],
    ['parameter', 'org.rust.PARAMETER'],
    ['builtinType', 'org.rust.PRIMITIVE_TYPE'],
    ['attribute', 'org.rust.ATTRIBUTE'],
    ['attributeBracket', 'org.rust.ATTRIBUTE'],
    ['builtinAttribute', 'org.rust.ATTRIBUTE'],
    ['derive', 'org.rust.ATTRIBUTE'],
    ['namespace', 'org.rust.MODULE'],
    ['crateRoot', 'org.rust.MODULE'],
    ['struct', 'org.rust.STRUCT'],
    ['enum', 'org.rust.ENUM'],
    ['trait', 'org.rust.TRAIT'],
    ['typeAlias', 'org.rust.STRUCT'],
    ['union', 'org.rust.STRUCT'],
    ['formatSpecifier', 'org.rust.FORMAT_PARAMETER'],
    ['escapeSequence', 'DEFAULT_VALID_STRING_ESCAPE'],
    ['operator', 'DEFAULT_OPERATION_SIGN'],
  ]),
  // Go (gopls with "ui.semanticTokens": true)
  ...forLanguages(['go'], [
    ['namespace', 'GO_PACKAGE'],
    ['type', 'GO_TYPE_REFERENCE'],
    ['type.definition', 'GO_TYPE_SPECIFICATION'],
    ['type.defaultLibrary', 'GO_BUILTIN_TYPE_REFERENCE'],
    ['function', 'GO_LOCAL_FUNCTION_CALL'],
    ['function.definition', 'GO_LOCAL_FUNCTION'],
    ['function.defaultLibrary', 'GO_BUILTIN_FUNCTION_CALL'],
    ['method', 'GO_LOCAL_FUNCTION_CALL'],
    ['method.definition', 'GO_LOCAL_FUNCTION'],
    ['parameter', 'GO_FUNCTION_PARAMETER'],
    ['variable', 'GO_LOCAL_VARIABLE'],
    ['variable.readonly', 'GO_PACKAGE_LOCAL_CONSTANT'],
    ['variable.defaultLibrary', 'GO_BUILTIN_CONSTANT'],
    ['property', 'GO_STRUCT_FIELD'],
  ]),
  // C / C++ (clangd)
  ...forLanguages(['cpp', 'c', 'cuda-cpp', 'objective-c', 'objective-cpp'], [
    ['macro', 'CPP.MACRO'],
    ['function', 'DEFAULT_FUNCTION_CALL'],
    ['function.declaration', 'DEFAULT_FUNCTION_DECLARATION'],
    ['method', 'DEFAULT_FUNCTION_CALL'],
    ['method.declaration', 'DEFAULT_FUNCTION_DECLARATION'],
    ['method.static', 'DEFAULT_STATIC_METHOD'],
    ['property', 'DEFAULT_INSTANCE_FIELD'],
    ['property.static', 'DEFAULT_STATIC_FIELD'],
    ['variable', 'DEFAULT_LOCAL_VARIABLE'],
    ['variable.globalScope', 'DEFAULT_GLOBAL_VARIABLE'],
    ['parameter', 'DEFAULT_PARAMETER'],
    ['enumMember', 'DEFAULT_CONSTANT'],
    ['namespace', 'TEXT'],
    ['typeParameter', 'TYPE_PARAMETER_NAME_ATTRIBUTES'],
    ['concept', 'DEFAULT_INTERFACE_NAME'],
  ]),
  // PHP (language servers with semantic tokens, e.g. DEVSENSE PHP Tools)
  ...forLanguages(['php'], [
    ['variable', 'PHP.VARIABLE'],
    ['parameter', 'PHP.VARIABLE'],
    ['property', 'DEFAULT_INSTANCE_FIELD'],
    ['property.static', 'DEFAULT_STATIC_FIELD'],
    ['enumMember', 'PHP.CONSTANT'],
    ['variable.readonly', 'PHP.CONSTANT'],
  ]),
];

function tokenSettings(s, key) {
  const a = s.resolve(key);
  const out = {};
  if (a.FOREGROUND) out.foreground = a.FOREGROUND;
  const ft = Number(a.FONT_TYPE ?? 0);
  const styles = [];
  if (ft & 2) styles.push('italic');
  if (ft & 1) styles.push('bold');
  // EFFECT_TYPE (TextAttributesReader): 0 box, 1 underline, 2 wave, 3 strikeout, 4 bold underline, 5 dotted; only shown by IntelliJ when an effect color is set
  if (a.EFFECT_COLOR && ['1', '4', '5'].includes(a.EFFECT_TYPE)) styles.push('underline');
  if (a.EFFECT_COLOR && a.EFFECT_TYPE === '3') styles.push('strikethrough');
  out.fontStyle = styles.join(' '); // explicit "" resets italics inherited from broader rules
  if (!out.foreground) out.foreground = s.text.FOREGROUND;
  return out;
}

function semanticSettings(s, key) {
  const t = tokenSettings(s, key);
  const r = { foreground: t.foreground };
  r.italic = t.fontStyle.includes('italic');
  r.bold = t.fontStyle.includes('bold');
  if (t.fontStyle.includes('underline')) r.underline = true;
  if (t.fontStyle.includes('strikethrough')) r.strikethrough = true;
  return r;
}

// ---------------------------------------------------------------------------------------------
// Workbench colors
// ---------------------------------------------------------------------------------------------
function workbench(ui, s) {
  const p = n => {
    const c = ui.color(n);
    if (!c) throw new Error(`palette color ${n} missing in ${ui.name}`);
    return c;
  };
  const c = n => s.colors[n];
  const fg = k => s.resolve(k).FOREGROUND;
  const bg = k => s.resolve(k).BACKGROUND;
  const eff = k => s.resolve(k).EFFECT_COLOR;
  const stripe = k => s.resolve(k).ERROR_STRIPE_COLOR;
  const dark = ui.dark;
  const editorBg = s.text.BACKGROUND;
  const editorFg = s.text.FOREGROUND;
  const main = p('main-window-bg');
  const island = p('tool-window-bg');
  const popup = p('popup-bg');
  const popupBorder = p('popup-border');
  const accent = p('accent-brand-bg');
  const selection = p('selection-bg-active');
  const selectionInactive = p('selection-bg-inactive');
  const hover = p('selection-bg-hovered');
  const text = p('text-default');
  const muted = p('text-muted');
  const secondary = p('text-secondary');
  const shadow = dark ? '#00000066' : '#0000001F';
  const transparent = '#00000000';
  const console = k => fg(`CONSOLE_${k}_OUTPUT`);

  return {
    // base
    foreground: text,
    descriptionForeground: muted,
    disabledForeground: p('text-disabled'),
    errorForeground: p('text-error'),
    focusBorder: accent,
    'icon.foreground': p('icon-default-stroke'),
    'selection.background': alpha(c('SELECTION_BACKGROUND'), 0.8),
    'widget.shadow': shadow,
    'widget.border': popupBorder,
    'sash.hoverBorder': accent,
    'textLink.foreground': p('text-link'),
    'textLink.activeForeground': p('text-link'),
    'textPreformat.foreground': editorFg,
    'textPreformat.background': p('editor-bg-inline'),
    'textBlockQuote.background': p('editor-bg-inline'),
    'textBlockQuote.border': p('editor-border-alt'),
    'textCodeBlock.background': p('editor-bg-inline'),
    'textSeparator.foreground': popupBorder,
    'progressBar.background': accent,
    'toolbar.hoverBackground': p('toolbar-bg-hovered'),
    'toolbar.activeBackground': p('toolbar-bg-pressed'),

    // window frame = IntelliJ's main window (the "sea" around the islands)
    'titleBar.activeBackground': main,
    'titleBar.activeForeground': text,
    'titleBar.inactiveBackground': main,
    'titleBar.inactiveForeground': muted,
    'titleBar.border': main,
    'commandCenter.background': p('main-window-bg-alt'),
    'commandCenter.foreground': text,
    'commandCenter.activeBackground': p('toolbar-bg-hovered'),
    'commandCenter.border': transparent,
    'commandCenter.inactiveBorder': transparent,
    'commandCenter.activeBorder': transparent,
    'menubar.selectionBackground': p('toolbar-bg-hovered'),
    'activityBar.background': main,
    'activityBar.foreground': p('icon-default-stroke'),
    'activityBar.inactiveForeground': muted,
    'activityBar.border': main,
    'activityBar.activeBorder': transparent,
    'activityBar.activeBackground': p('toolbar-selected-bg'),
    'activityBar.activeFocusBorder': accent,
    'activityBar.dropBorder': accent,
    'activityBarBadge.background': accent,
    'activityBarBadge.foreground': p('text-over-accent'),
    'activityBarTop.foreground': text,
    'activityBarTop.inactiveForeground': muted,
    'activityBarTop.activeBorder': accent,
    'statusBar.background': main,
    'statusBar.foreground': muted,
    'statusBar.border': main,
    'statusBar.focusBorder': accent,
    'statusBar.noFolderBackground': main,
    'statusBar.noFolderForeground': muted,
    'statusBar.debuggingBackground': main,
    'statusBar.debuggingForeground': muted,
    'statusBar.debuggingBorder': main,
    'statusBarItem.hoverBackground': p('toolbar-bg-hovered'),
    'statusBarItem.hoverForeground': text,
    'statusBarItem.activeBackground': p('toolbar-bg-pressed'),
    'statusBarItem.remoteBackground': main,
    'statusBarItem.remoteForeground': text,
    'statusBarItem.remoteHoverBackground': p('toolbar-bg-hovered'),
    'statusBarItem.errorBackground': main,
    'statusBarItem.errorForeground': p('text-error'),
    'statusBarItem.warningBackground': main,
    'statusBarItem.warningForeground': p('text-warning'),
    'statusBarItem.prominentBackground': p('toolbar-selected-bg'),
    'statusBarItem.prominentHoverBackground': p('toolbar-selected-bg-hovered'),
    'statusBarItem.compactHoverBackground': p('toolbar-bg-hovered'),
    'statusBarItem.offlineBackground': p('accent-warning-bg'),

    // VS Code's "modern UI" (floating surfaces) is IntelliJ's islands layout: the shell is the main window
    'modernUI.shellBackground': main,
    'modernUI.inactiveShellBackground': main,
    'surface.background': island,
    'surface.foreground': text,
    'surface.border': island, // IntelliJ: Island.borderColor = island background → no visible border
    'editor.border': island,
    'editorPane.background': editorBg,
    'modernPanel.border': island,
    'modernSash.gripForeground': alpha(muted, 0.5),
    'modernActivityBar.background': main,
    'modernActivityBar.inactiveBackground': main,
    'modernActivityBar.border': main,
    'modernActivityBarItem.activeBackground': p('toolbar-selected-bg'),
    'modernActivityBarItem.activeForeground': text,
    'modernActivityBarItem.hoverBackground': p('toolbar-bg-hovered'),
    'modernActivityBarItem.hoverForeground': text,
    'modernTab.activeBackground': p('tab-selected-bg-active'),
    'modernTab.activeForeground': text,
    'modernTab.hoverBackground': p('tab-bg-hovered'),
    'modernTab.hoverForeground': text,
    'modernEditorTab.activeBackground': p('tab-selected-bg-active'),
    'modernEditorTab.activeForeground': text,
    'modernEditorTab.activeHoverBackground': p('tab-selected-bg-active'),
    'modernEditorTab.inactiveBackground': transparent,
    'modernEditorTab.hoverBackground': p('tab-bg-hovered'),
    'modernEditorTab.hoverForeground': text,

    // islands: side bar, editor, panel
    'sideBar.background': island,
    'sideBar.foreground': text,
    'sideBar.border': main,
    'sideBar.dropBackground': alpha(accent, 0.18),
    'sideBarTitle.foreground': text,
    'sideBarTitle.background': island,
    'sideBarSectionHeader.background': island,
    'sideBarSectionHeader.foreground': text,
    'sideBarSectionHeader.border': p('tool-window-border'),
    'sideBarActivityBarTop.border': p('tool-window-border'),
    'sideBarStickyScroll.background': island,
    'sideBarStickyScroll.shadow': shadow,
    'auxiliaryBar.background': island,
    'panel.background': island,
    'panel.border': main,
    'panel.dropBorder': accent,
    'panelTitle.activeForeground': text,
    'panelTitle.inactiveForeground': muted,
    'panelTitle.activeBorder': accent,
    'panelTitleBadge.background': accent,
    'panelTitleBadge.foreground': p('text-over-accent'),
    'panelSection.border': p('tool-window-border'),
    'panelSectionHeader.background': island,
    'panelInput.border': p('control-border'),
    'outputView.background': island,
    'outputViewStickyScroll.background': island,

    // editor groups and tabs
    'editorGroup.border': main,
    'editorGroup.dropBackground': alpha(accent, 0.18),
    'editorGroup.emptyBackground': editorBg,
    'editorGroupHeader.tabsBackground': p('editor-bg'),
    'editorGroupHeader.tabsBorder': p('editor-border'),
    'editorGroupHeader.noTabsBackground': editorBg,
    'editorGroupHeader.border': p('editor-border'),
    'tab.activeBackground': p('tab-selected-bg-active'),
    'tab.activeForeground': text,
    'tab.activeBorder': transparent,
    'tab.activeBorderTop': transparent,
    'tab.selectedBackground': p('tab-selected-bg-active'),
    'tab.selectedForeground': text,
    'tab.unfocusedActiveBackground': p('tab-selected-bg-inactive'),
    'tab.unfocusedActiveForeground': text,
    'tab.unfocusedActiveBorder': transparent,
    'tab.unfocusedActiveBorderTop': transparent,
    'tab.inactiveBackground': p('editor-bg'),
    'tab.inactiveForeground': muted,
    'tab.unfocusedInactiveBackground': p('editor-bg'),
    'tab.unfocusedInactiveForeground': muted,
    'tab.hoverBackground': p('tab-bg-hovered'),
    'tab.unfocusedHoverBackground': p('tab-bg-hovered'),
    'tab.hoverForeground': text,
    'tab.border': p('editor-bg'),
    'tab.lastPinnedBorder': p('editor-border-alt'),
    'tab.dragAndDropBorder': accent,
    'tab.activeModifiedBorder': c('MODIFIED_TAB_ICON'),
    'tab.inactiveModifiedBorder': alpha(c('MODIFIED_TAB_ICON'), 0.6),
    'breadcrumb.background': editorBg,
    'breadcrumb.foreground': muted,
    'breadcrumb.focusForeground': text,
    'breadcrumb.activeSelectionForeground': text,
    'breadcrumbPicker.background': popup,

    // editor (from the editor color scheme)
    'editor.background': editorBg,
    'editor.foreground': editorFg,
    'editorCursor.foreground': c('CARET_COLOR'),
    'editor.lineHighlightBackground': c('CARET_ROW_COLOR'),
    'editor.lineHighlightBorder': transparent,
    'editorLineNumber.foreground': c('LINE_NUMBERS_COLOR'),
    'editorLineNumber.activeForeground': c('LINE_NUMBER_ON_CARET_ROW_COLOR'),
    'editorLineNumber.dimmedForeground': alpha(c('LINE_NUMBERS_COLOR'), 0.6),
    'editor.selectionBackground': c('SELECTION_BACKGROUND'),
    'editor.inactiveSelectionBackground': alpha(c('SELECTION_BACKGROUND'), 0.55),
    'editor.selectionHighlightBackground': bg('IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editor.wordHighlightBackground': bg('IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editor.wordHighlightStrongBackground': bg('WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editor.wordHighlightTextBackground': bg('IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editor.findMatchBackground': bg('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'editor.findMatchBorder': stripe('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'editor.findMatchHighlightBackground': bg('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'editor.findMatchHighlightBorder': eff('TEXT_SEARCH_RESULT_ATTRIBUTES') ?? transparent,
    'editor.findRangeHighlightBackground': alpha(c('SELECTION_BACKGROUND'), 0.25),
    'editor.rangeHighlightBackground': alpha(bg('SEARCH_RESULT_ATTRIBUTES'), 0.5),
    'editor.hoverHighlightBackground': alpha(bg('IDENTIFIER_UNDER_CARET_ATTRIBUTES'), 0.8),
    'editor.linkedEditingBackground': alpha(bg('IDENTIFIER_UNDER_CARET_ATTRIBUTES'), 0.8),
    'editor.foldBackground': alpha(bg('FOLDED_TEXT_ATTRIBUTES'), 0.35),
    'editor.foldPlaceholderForeground': fg('FOLDED_TEXT_ATTRIBUTES'),
    'editorBracketMatch.background': bg('MATCHED_BRACE_ATTRIBUTES'),
    'editorBracketMatch.border': transparent,
    'editorIndentGuide.background1': c('INDENT_GUIDE'),
    'editorIndentGuide.activeBackground1': c('SELECTED_INDENT_GUIDE'),
    'editorRuler.foreground': c('RIGHT_MARGIN_COLOR'),
    'editorWhitespace.foreground': alpha(c('WHITESPACES'), 0.6),
    'editorCodeLens.foreground': fg('INLAY_TEXT_WITHOUT_BACKGROUND'),
    'editorInlayHint.foreground': fg('INLAY_TEXT_WITHOUT_BACKGROUND'),
    'editorInlayHint.background': transparent,
    'editorInlayHint.parameterForeground': fg('INLINE_PARAMETER_HINT'),
    'editorInlayHint.parameterBackground': bg('INLINE_PARAMETER_HINT'),
    'editorInlayHint.typeForeground': fg('INLAY_DEFAULT'),
    'editorInlayHint.typeBackground': bg('INLAY_DEFAULT'),
    'editorLink.activeForeground': fg('HYPERLINK_ATTRIBUTES'),
    'editorUnnecessaryCode.opacity': '#000000A0',
    'editorError.foreground': eff('ERRORS_ATTRIBUTES'),
    'editorWarning.foreground': eff('WARNING_ATTRIBUTES'),
    'editorInfo.foreground': p('text-link'),
    'editorHint.foreground': eff('INFO_ATTRIBUTES') ?? muted,
    'problemsErrorIcon.foreground': p('text-error'),
    'problemsWarningIcon.foreground': p('text-warning'),
    'problemsInfoIcon.foreground': p('text-link'),
    'editorGutter.background': editorBg,
    'editorGutter.addedBackground': c('ADDED_LINES_COLOR'),
    'editorGutter.modifiedBackground': c('MODIFIED_LINES_COLOR'),
    'editorGutter.deletedBackground': c('DELETED_LINES_COLOR'),
    'editorGutter.foldingControlForeground': muted,
    'editorOverviewRuler.border': transparent,
    'editorOverviewRuler.background': editorBg,
    'editorOverviewRuler.addedForeground': c('ADDED_LINES_COLOR'),
    'editorOverviewRuler.modifiedForeground': c('MODIFIED_LINES_COLOR'),
    'editorOverviewRuler.deletedForeground': c('DELETED_LINES_COLOR'),
    'editorOverviewRuler.errorForeground': stripe('ERRORS_ATTRIBUTES'),
    'editorOverviewRuler.warningForeground': stripe('WARNING_ATTRIBUTES'),
    'editorOverviewRuler.findMatchForeground': stripe('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'editorOverviewRuler.wordHighlightForeground': stripe('IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editorOverviewRuler.wordHighlightStrongForeground': stripe('WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editorOverviewRuler.selectionHighlightForeground': stripe('IDENTIFIER_UNDER_CARET_ATTRIBUTES'),
    'editorOverviewRuler.bracketMatchForeground': transparent,
    'editorStickyScroll.background': editorBg,
    'editorStickyScroll.border': p('editor-border'),
    'editorStickyScroll.shadow': shadow,
    'editorStickyScrollHover.background': c('CARET_ROW_COLOR'),
    // IntelliJ doesn't colorize bracket pairs: all levels use the text color
    ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`editorBracketHighlight.foreground${i}`, editorFg])),
    'editorBracketHighlight.unexpectedBracket.foreground': fg('UNMATCHED_BRACE_ATTRIBUTES') ?? fg('WRONG_REFERENCES_ATTRIBUTES'),
    'editorBracketPairGuide.activeBackground1': c('MATCHED_BRACES_INDENT_GUIDE_COLOR'),
    'minimap.background': editorBg,
    'minimap.selectionHighlight': c('SELECTION_BACKGROUND'),
    'minimap.findMatchHighlight': stripe('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'minimapGutter.addedBackground': c('ADDED_LINES_COLOR'),
    'minimapGutter.modifiedBackground': c('MODIFIED_LINES_COLOR'),
    'minimapGutter.deletedBackground': c('DELETED_LINES_COLOR'),
    'minimapSlider.background': alpha(c('LINE_NUMBERS_COLOR'), 0.25),
    'minimapSlider.hoverBackground': alpha(c('LINE_NUMBERS_COLOR'), 0.4),
    'minimapSlider.activeBackground': alpha(c('LINE_NUMBERS_COLOR'), 0.5),

    // widgets / popups (IntelliJ: popup-bg)
    'editorWidget.background': popup,
    'editorWidget.foreground': text,
    'editorWidget.border': popupBorder,
    'editorWidget.resizeBorder': accent,
    'editorSuggestWidget.background': popup,
    'editorSuggestWidget.border': popupBorder,
    'editorSuggestWidget.foreground': editorFg,
    'editorSuggestWidget.selectedBackground': selection,
    'editorSuggestWidget.selectedForeground': text,
    'editorSuggestWidget.highlightForeground': p('popup-completion-match-text'),
    'editorSuggestWidget.focusHighlightForeground': p('popup-completion-match-text'),
    'editorSuggestWidgetStatus.foreground': secondary,
    'editorHoverWidget.background': popup,
    'editorHoverWidget.foreground': text,
    'editorHoverWidget.border': popupBorder,
    'editorHoverWidget.highlightForeground': p('popup-completion-match-text'),
    'editorHoverWidget.statusBarBackground': popup,
    'editorMarkerNavigation.background': popup,
    'editorMarkerNavigationError.background': p('feedback-error-border'),
    'editorMarkerNavigationWarning.background': p('feedback-warning-border'),
    'editorMarkerNavigationInfo.background': p('feedback-brand-border'),
    'debugExceptionWidget.background': p('feedback-error-bg'),
    'debugExceptionWidget.border': p('feedback-error-border'),
    'peekView.border': p('accent-brand-border-secondary'),
    'peekViewTitle.background': popup,
    'peekViewTitleLabel.foreground': text,
    'peekViewTitleDescription.foreground': muted,
    'peekViewEditor.background': p('editor-bg-inline'),
    'peekViewEditorGutter.background': p('editor-bg-inline'),
    'peekViewEditor.matchHighlightBackground': bg('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'peekViewResult.background': popup,
    'peekViewResult.fileForeground': text,
    'peekViewResult.lineForeground': muted,
    'peekViewResult.matchHighlightBackground': bg('TEXT_SEARCH_RESULT_ATTRIBUTES'),
    'peekViewResult.selectionBackground': selection,
    'peekViewResult.selectionForeground': text,
    'quickInput.background': popup,
    'quickInput.foreground': text,
    'quickInputTitle.background': popup,
    'quickInputList.focusBackground': selection,
    'quickInputList.focusForeground': text,
    'quickInputList.focusIconForeground': text,
    'pickerGroup.border': popupBorder,
    'pickerGroup.foreground': secondary,
    'menu.background': popup,
    'menu.foreground': text,
    'menu.border': popupBorder,
    'menu.selectionBackground': selection,
    'menu.selectionForeground': text,
    'menu.separatorBackground': popupBorder,
    'notifications.background': p('feedback-bg'),
    'notifications.foreground': text,
    'notifications.border': p('feedback-border'),
    'notificationCenter.border': p('feedback-border'),
    'notificationCenterHeader.background': p('feedback-bg'),
    'notificationCenterHeader.foreground': text,
    'notificationToast.border': p('feedback-border'),
    'notificationLink.foreground': p('text-link'),
    'notificationsErrorIcon.foreground': p('text-error'),
    'notificationsWarningIcon.foreground': p('text-warning'),
    'notificationsInfoIcon.foreground': p('text-link'),
    'hover.background': popup,

    // lists & trees
    'list.activeSelectionBackground': selection,
    'list.activeSelectionForeground': text,
    'list.activeSelectionIconForeground': text,
    'list.inactiveSelectionBackground': selectionInactive,
    'list.inactiveSelectionForeground': text,
    'list.focusBackground': selection,
    'list.focusForeground': text,
    'list.focusOutline': transparent,
    'list.focusAndSelectionOutline': transparent,
    'list.inactiveFocusOutline': transparent,
    'list.hoverBackground': hover,
    'list.hoverForeground': text,
    'list.highlightForeground': p('popup-completion-match-text'),
    'list.focusHighlightForeground': p('popup-completion-match-text'),
    'list.dropBackground': alpha(accent, 0.2),
    'list.errorForeground': p('text-error'),
    'list.warningForeground': p('text-warning'),
    'list.inactiveSelectionIconForeground': text,
    'tree.indentGuidesStroke': p('tree-indent-guide-border'),
    'tree.inactiveIndentGuidesStroke': p('tree-indent-guide-border'),
    'listFilterWidget.background': popup,
    'listFilterWidget.outline': accent,
    'listFilterWidget.noMatchesOutline': p('control-error-border'),

    // controls
    'button.background': p('control-brand-bg'),
    'button.foreground': p('text-over-accent'),
    'button.hoverBackground': p('toolbar-selected-bg-hovered'),
    'button.border': transparent,
    'button.separator': p('control-border-over-accent'),
    'button.secondaryBackground': p('control-bg-raised'),
    'button.secondaryForeground': text,
    'button.secondaryHoverBackground': p('toolbar-bg-hovered'),
    'checkbox.background': p('control-bg'),
    'checkbox.border': p('control-border'),
    'checkbox.foreground': text,
    'checkbox.selectBackground': p('control-brand-bg'),
    'checkbox.selectBorder': p('control-brand-border'),
    'dropdown.background': p('control-bg-raised'),
    'dropdown.listBackground': popup,
    'dropdown.border': p('control-border'),
    'dropdown.foreground': text,
    'input.background': p('control-bg'),
    'input.border': p('control-border'),
    'input.foreground': text,
    'input.placeholderForeground': secondary,
    'inputOption.activeBackground': p('toolbar-selected-bg'),
    'inputOption.activeBorder': transparent,
    'inputOption.activeForeground': text,
    'inputOption.hoverBackground': p('toolbar-bg-hovered'),
    'inputValidation.errorBackground': p('feedback-error-bg'),
    'inputValidation.errorBorder': p('feedback-error-border'),
    'inputValidation.warningBackground': p('feedback-warning-bg'),
    'inputValidation.warningBorder': p('feedback-warning-border'),
    'inputValidation.infoBackground': p('feedback-brand-bg'),
    'inputValidation.infoBorder': p('feedback-brand-border'),
    'badge.background': accent,
    'badge.foreground': p('text-over-accent'),
    'keybindingLabel.background': p('control-bg-small'),
    'keybindingLabel.foreground': text,
    'keybindingLabel.border': p('control-border-small'),
    'keybindingLabel.bottomBorder': p('control-border-small'),
    'scrollbar.shadow': transparent,
    'scrollbarSlider.background': ui.get('ScrollBar.Transparent.thumbColor') ?? alpha(muted, 0.35),
    'scrollbarSlider.hoverBackground': ui.get('ScrollBar.Transparent.hoverThumbColor') ?? alpha(muted, 0.55),
    'scrollbarSlider.activeBackground': ui.get('ScrollBar.Transparent.hoverThumbColor') ?? alpha(muted, 0.55),
    'settings.headerForeground': text,
    'settings.modifiedItemIndicator': c('MODIFIED_TAB_ICON'),
    'settings.dropdownBackground': p('control-bg-raised'),
    'settings.dropdownBorder': p('control-border'),
    'settings.checkboxBackground': p('control-bg'),
    'settings.checkboxBorder': p('control-border'),
    'settings.textInputBackground': p('control-bg'),
    'settings.textInputBorder': p('control-border'),
    'settings.numberInputBackground': p('control-bg'),
    'settings.numberInputBorder': p('control-border'),
    'settings.focusedRowBackground': hover,
    'settings.rowHoverBackground': hover,
    'welcomePage.tileBackground': p('layer-1-bg'),
    'welcomePage.tileHoverBackground': p('layer-2-bg'),
    'walkThrough.embeddedEditorBackground': p('editor-bg-inline'),

    // source control / diff (IntelliJ file status + diff colors)
    'gitDecoration.modifiedResourceForeground': c('FILESTATUS_MODIFIED'),
    'gitDecoration.addedResourceForeground': c('FILESTATUS_ADDED'),
    'gitDecoration.stageModifiedResourceForeground': c('FILESTATUS_MODIFIED'),
    'gitDecoration.stageDeletedResourceForeground': c('FILESTATUS_DELETED'),
    'gitDecoration.deletedResourceForeground': c('FILESTATUS_DELETED'),
    'gitDecoration.renamedResourceForeground': c('FILESTATUS_RENAMED') ?? c('FILESTATUS_MODIFIED'),
    'gitDecoration.untrackedResourceForeground': c('FILESTATUS_UNKNOWN'),
    'gitDecoration.ignoredResourceForeground': c('FILESTATUS_IDEA_FILESTATUS_IGNORED'),
    'gitDecoration.conflictingResourceForeground': c('FILESTATUS_IDEA_FILESTATUS_MERGED_WITH_CONFLICTS'),
    'gitDecoration.submoduleResourceForeground': muted,
    'diffEditor.insertedLineBackground': alpha(bg('DIFF_INSERTED'), 0.7),
    'diffEditor.insertedTextBackground': alpha(stripe('DIFF_INSERTED'), 0.45),
    'diffEditor.removedLineBackground': alpha(bg('DIFF_DELETED'), 0.7),
    'diffEditor.removedTextBackground': alpha(stripe('DIFF_DELETED'), 0.45),
    'diffEditor.diagonalFill': alpha(c('DIFF_SEPARATOR_WAVE') ?? muted, 0.4),
    'diffEditor.unchangedRegionBackground': p('editor-bg-inline'),
    'diffEditorGutter.insertedLineBackground': alpha(bg('DIFF_INSERTED'), 0.7),
    'diffEditorGutter.removedLineBackground': alpha(bg('DIFF_DELETED'), 0.7),
    'diffEditorOverview.insertedForeground': stripe('DIFF_INSERTED'),
    'diffEditorOverview.removedForeground': stripe('DIFF_DELETED'),
    'merge.currentHeaderBackground': alpha(stripe('DIFF_INSERTED'), 0.6),
    'merge.currentContentBackground': alpha(bg('DIFF_INSERTED'), 0.5),
    'merge.incomingHeaderBackground': alpha(stripe('DIFF_MODIFIED'), 0.6),
    'merge.incomingContentBackground': alpha(bg('DIFF_MODIFIED'), 0.5),
    'merge.commonHeaderBackground': alpha(stripe('DIFF_DELETED'), 0.6),
    'merge.commonContentBackground': alpha(bg('DIFF_DELETED'), 0.5),
    'mergeEditor.conflict.unhandledUnfocused.border': stripe('DIFF_CONFLICT'),
    'mergeEditor.conflict.unhandledFocused.border': stripe('DIFF_CONFLICT'),
    'scmGraph.historyItemHoverDefaultLabelForeground': text,

    // debugging
    'editor.stackFrameHighlightBackground': alpha(bg('EXECUTIONPOINT_ATTRIBUTES'), 0.6),
    'editor.focusedStackFrameHighlightBackground': alpha(bg('EXECUTIONPOINT_ATTRIBUTES'), 0.6),
    'debugIcon.breakpointForeground': p('accent-error-bg'),
    'debugIcon.breakpointDisabledForeground': p('text-disabled'),
    'debugToolBar.background': popup,
    'debugToolBar.border': popupBorder,
    'debugTokenExpression.name': fg('INSTANCE_FIELD_ATTRIBUTES'),
    'debugTokenExpression.value': editorFg,
    'debugTokenExpression.string': fg('DEFAULT_STRING'),
    'debugTokenExpression.number': fg('DEFAULT_NUMBER'),
    'debugTokenExpression.boolean': fg('DEFAULT_KEYWORD'),
    'debugTokenExpression.error': p('text-error'),

    // terminal (IntelliJ console colors)
    'terminal.background': c('CONSOLE_BACKGROUND_KEY') ?? island,
    'terminal.foreground': console('NORMAL') ?? editorFg,
    'terminal.selectionBackground': c('SELECTION_BACKGROUND'),
    'terminalCursor.foreground': c('CARET_COLOR'),
    'terminal.border': main,
    'terminal.ansiBlack': console('BLACK'),
    'terminal.ansiRed': console('RED'),
    'terminal.ansiGreen': console('GREEN'),
    'terminal.ansiYellow': console('YELLOW'),
    'terminal.ansiBlue': console('BLUE'),
    'terminal.ansiMagenta': console('MAGENTA'),
    'terminal.ansiCyan': console('CYAN'),
    'terminal.ansiWhite': console('GRAY'),
    'terminal.ansiBrightBlack': console('DARKGRAY'),
    'terminal.ansiBrightRed': console('RED_BRIGHT'),
    'terminal.ansiBrightGreen': console('GREEN_BRIGHT'),
    'terminal.ansiBrightYellow': console('YELLOW_BRIGHT'),
    'terminal.ansiBrightBlue': console('BLUE_BRIGHT'),
    'terminal.ansiBrightMagenta': console('MAGENTA_BRIGHT'),
    'terminal.ansiBrightCyan': console('CYAN_BRIGHT'),
    'terminal.ansiBrightWhite': console('WHITE'),
    'terminalCommandDecoration.defaultBackground': muted,
    'terminalCommandDecoration.successBackground': p('text-success'),
    'terminalCommandDecoration.errorBackground': p('text-error'),
    'testing.iconPassed': p('icon-green-stroke'),
    'testing.iconFailed': p('accent-error-bg'),
    'testing.iconErrored': p('accent-error-bg'),
    'testing.runAction': p('icon-green-stroke'),
    'charts.foreground': text,
    'charts.lines': muted,
    'charts.red': p('text-error'),
    'charts.blue': p('text-link'),
    'charts.yellow': p('text-warning'),
    'charts.green': p('text-success'),
    'charts.orange': fg('DEFAULT_KEYWORD'),
    'charts.purple': fg('DEFAULT_INSTANCE_FIELD'),
  };
}

function build(variant) {
  const s = scheme.load(variant);
  const ui = uiTheme.load(variant === 'dark' ? 'Islands Dark' : 'Islands Light');
  const tokenColors = TOKENS.map(([name, scope, key]) => {
    const settings = tokenSettings(s, key);
    // inside doc comments IntelliJ layers the tag attributes on top of the doc comment (keeps its italics)
    if (/^Doc comment ./.test(name)) {
      const doc = tokenSettings(s, 'DEFAULT_DOC_COMMENT').fontStyle.split(' ').filter(Boolean);
      settings.fontStyle = [...new Set([...doc, ...settings.fontStyle.split(' ').filter(Boolean)])].join(' ');
    }
    return { name, scope, settings };
  });
  const semanticTokenColors = Object.fromEntries(SEMANTIC.map(([sel, key]) => [sel, semanticSettings(s, key)]));
  // Kotlin: IntelliJ underlines mutable local variables (`var`); `val`s are readonly
  const mutable = s.resolve('KOTLIN_MUTABLE_VARIABLE');
  if (mutable.EFFECT_COLOR && mutable.EFFECT_TYPE === '1') {
    semanticTokenColors['variable:kotlin'] = { ...semanticSettings(s, 'KOTLIN_LOCAL_VARIABLE'), underline: true };
    semanticTokenColors['variable.readonly:kotlin'] = { ...semanticSettings(s, 'KOTLIN_LOCAL_VARIABLE'), underline: false };
  }
  semanticTokenColors['*.deprecated'] = { strikethrough: true };
  const colors = workbench(ui, s);
  for (const [k, v] of Object.entries(colors)) if (v === undefined) delete colors[k];
  return {
    $schema: 'vscode://schemas/color-theme',
    name: variant === 'dark' ? 'Islands Dark' : 'Islands Light',
    type: variant,
    semanticHighlighting: true,
    colors,
    tokenColors,
    semanticTokenColors,
  };
}

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const v of ['dark', 'light']) {
    const theme = build(v);
    const file = path.join(OUT, `islands-${v}-color-theme.json`);
    fs.writeFileSync(file, JSON.stringify(theme, null, 2) + '\n');
    console.log(`wrote ${path.relative(process.cwd(), file)}: ${Object.keys(theme.colors).length} colors, ${theme.tokenColors.length} token rules`);
  }
}

module.exports = { build, TOKENS, SEMANTIC };
