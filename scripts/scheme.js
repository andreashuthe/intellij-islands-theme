// Reads IntelliJ editor color schemes (XML) and resolves text attributes the way the IDE does:
// own value → baseAttributes → parent scheme → fallback key (as declared in the IDE's *HighlightingColors).
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'jetbrains');

/** Fallback keys (TextAttributesKey.createTextAttributesKey(name, fallback)) from the IntelliJ sources. */
const FALLBACK = {
  // DefaultLanguageHighlighterColors
  DEFAULT_TEMPLATE_LANGUAGE_COLOR: 'TEXT', DEFAULT_IDENTIFIER: 'TEXT', DEFAULT_LABEL: 'DEFAULT_IDENTIFIER',
  DEFAULT_CONSTANT: 'DEFAULT_IDENTIFIER', DEFAULT_LOCAL_VARIABLE: 'DEFAULT_IDENTIFIER',
  DEFAULT_REASSIGNED_LOCAL_VARIABLE: 'DEFAULT_LOCAL_VARIABLE', DEFAULT_GLOBAL_VARIABLE: 'DEFAULT_IDENTIFIER',
  DEFAULT_FUNCTION_DECLARATION: 'DEFAULT_IDENTIFIER', DEFAULT_FUNCTION_CALL: 'DEFAULT_IDENTIFIER',
  DEFAULT_PARAMETER: 'DEFAULT_IDENTIFIER', DEFAULT_REASSIGNED_PARAMETER: 'DEFAULT_PARAMETER',
  DEFAULT_CLASS_NAME: 'DEFAULT_IDENTIFIER', DEFAULT_INTERFACE_NAME: 'DEFAULT_IDENTIFIER',
  DEFAULT_CLASS_REFERENCE: 'DEFAULT_IDENTIFIER', DEFAULT_INSTANCE_METHOD: 'DEFAULT_FUNCTION_DECLARATION',
  DEFAULT_INSTANCE_FIELD: 'DEFAULT_IDENTIFIER', DEFAULT_STATIC_METHOD: 'DEFAULT_FUNCTION_DECLARATION',
  DEFAULT_STATIC_FIELD: 'DEFAULT_IDENTIFIER', DEFAULT_PREDEFINED_SYMBOL: 'DEFAULT_IDENTIFIER',
  DEFAULT_HIGHLIGHTED_REFERENCE: 'DEFAULT_STRING', DEFAULT_METADATA: 'TEXT', DEFAULT_TAG: 'TEXT',
  DEFAULT_ATTRIBUTE: 'DEFAULT_IDENTIFIER', DEFAULT_ENTITY: 'DEFAULT_IDENTIFIER',
  // JavaHighlightingColors
  JAVA_LINE_COMMENT: 'DEFAULT_LINE_COMMENT', JAVA_BLOCK_COMMENT: 'DEFAULT_BLOCK_COMMENT', JAVA_DOC_COMMENT: 'DEFAULT_DOC_COMMENT',
  JAVA_KEYWORD: 'DEFAULT_KEYWORD', JAVA_NUMBER: 'DEFAULT_NUMBER', JAVA_STRING: 'DEFAULT_STRING',
  JAVA_OPERATION_SIGN: 'DEFAULT_OPERATION_SIGN', JAVA_PARENTH: 'DEFAULT_PARENTHS', JAVA_BRACKETS: 'DEFAULT_BRACKETS',
  JAVA_BRACES: 'DEFAULT_BRACES', JAVA_COMMA: 'DEFAULT_COMMA', JAVA_DOT: 'DEFAULT_DOT', JAVA_SEMICOLON: 'DEFAULT_SEMICOLON',
  JAVA_DOC_TAG: 'DEFAULT_DOC_COMMENT_TAG', JAVA_DOC_MARKUP: 'DEFAULT_DOC_MARKUP', DOC_COMMENT_TAG_VALUE: 'DEFAULT_DOC_COMMENT_TAG_VALUE',
  JAVA_VALID_STRING_ESCAPE: 'DEFAULT_VALID_STRING_ESCAPE', JAVA_INVALID_STRING_ESCAPE: 'DEFAULT_INVALID_STRING_ESCAPE',
  LOCAL_VARIABLE_ATTRIBUTES: 'DEFAULT_LOCAL_VARIABLE', PARAMETER_ATTRIBUTES: 'DEFAULT_PARAMETER',
  LAMBDA_PARAMETER_ATTRIBUTES: 'PARAMETER_ATTRIBUTES', REASSIGNED_LOCAL_VARIABLE_ATTRIBUTES: 'DEFAULT_REASSIGNED_LOCAL_VARIABLE',
  REASSIGNED_PARAMETER_ATTRIBUTES: 'DEFAULT_REASSIGNED_PARAMETER', INSTANCE_FIELD_ATTRIBUTES: 'DEFAULT_INSTANCE_FIELD',
  INSTANCE_FINAL_FIELD_ATTRIBUTES: 'INSTANCE_FIELD_ATTRIBUTES', RECORD_COMPONENT_ATTRIBUTES: 'INSTANCE_FINAL_FIELD_ATTRIBUTES',
  STATIC_FIELD_ATTRIBUTES: 'DEFAULT_STATIC_FIELD', STATIC_FIELD_IMPORTED_ATTRIBUTES: 'STATIC_FIELD_ATTRIBUTES',
  STATIC_FINAL_FIELD_ATTRIBUTES: 'STATIC_FIELD_ATTRIBUTES', STATIC_FINAL_FIELD_IMPORTED_ATTRIBUTES: 'STATIC_FINAL_FIELD_ATTRIBUTES',
  CLASS_NAME_ATTRIBUTES: 'DEFAULT_CLASS_NAME', ANONYMOUS_CLASS_NAME_ATTRIBUTES: 'CLASS_NAME_ATTRIBUTES',
  TYPE_PARAMETER_NAME_ATTRIBUTES: 'DEFAULT_PARAMETER', INTERFACE_NAME_ATTRIBUTES: 'DEFAULT_INTERFACE_NAME',
  ENUM_NAME_ATTRIBUTES: 'CLASS_NAME_ATTRIBUTES', RECORD_NAME_ATTRIBUTES: 'CLASS_NAME_ATTRIBUTES',
  ABSTRACT_CLASS_NAME_ATTRIBUTES: 'CLASS_NAME_ATTRIBUTES', METHOD_CALL_ATTRIBUTES: 'DEFAULT_FUNCTION_CALL',
  METHOD_DECLARATION_ATTRIBUTES: 'DEFAULT_FUNCTION_DECLARATION', STATIC_METHOD_ATTRIBUTES: 'DEFAULT_STATIC_METHOD',
  STATIC_METHOD_IMPORTED_ATTRIBUTES: 'STATIC_METHOD_ATTRIBUTES', ABSTRACT_METHOD_ATTRIBUTES: 'METHOD_CALL_ATTRIBUTES',
  INHERITED_METHOD_ATTRIBUTES: 'METHOD_CALL_ATTRIBUTES', CONSTRUCTOR_CALL_ATTRIBUTES: 'DEFAULT_FUNCTION_CALL',
  CONSTRUCTOR_DECLARATION_ATTRIBUTES: 'DEFAULT_FUNCTION_DECLARATION', ANNOTATION_NAME_ATTRIBUTES: 'DEFAULT_METADATA',
  ANNOTATION_ATTRIBUTE_NAME_ATTRIBUTES: 'DEFAULT_METADATA',
  // KotlinHighlightingColors
  KOTLIN_KEYWORD: 'JAVA_KEYWORD', KOTLIN_BUILTIN_ANNOTATION: 'KOTLIN_KEYWORD', KOTLIN_KEYWORD_VAL: 'KOTLIN_KEYWORD',
  KOTLIN_KEYWORD_VAR: 'KOTLIN_KEYWORD', KOTLIN_NUMBER: 'DEFAULT_NUMBER', KOTLIN_STRING: 'DEFAULT_STRING',
  KOTLIN_STRING_ESCAPE: 'DEFAULT_VALID_STRING_ESCAPE', KOTLIN_OPERATION_SIGN: 'DEFAULT_OPERATION_SIGN',
  KOTLIN_LINE_COMMENT: 'DEFAULT_LINE_COMMENT', KOTLIN_BLOCK_COMMENT: 'DEFAULT_BLOCK_COMMENT',
  KOTLIN_DOC_COMMENT: 'DEFAULT_DOC_COMMENT', KDOC_TAG_NAME: 'DEFAULT_DOC_COMMENT_TAG', KDOC_LINK: 'DEFAULT_DOC_COMMENT_TAG_VALUE',
  KOTLIN_CLASS: 'DEFAULT_CLASS_NAME', KOTLIN_TYPE_PARAMETER: 'TYPE_PARAMETER_NAME_ATTRIBUTES',
  KOTLIN_ABSTRACT_CLASS: 'DEFAULT_CLASS_NAME', KOTLIN_TRAIT: 'DEFAULT_INTERFACE_NAME',
  KOTLIN_ANNOTATION: 'ANNOTATION_NAME_ATTRIBUTES', KOTLIN_OBJECT: 'KOTLIN_CLASS', KOTLIN_ENUM: 'ENUM_NAME_ATTRIBUTES',
  KOTLIN_ENUM_ENTRY: 'DEFAULT_STATIC_FIELD', KOTLIN_TYPE_ALIAS: 'KOTLIN_CLASS', KOTLIN_DATA_CLASS: 'KOTLIN_CLASS',
  KOTLIN_LOCAL_VARIABLE: 'DEFAULT_LOCAL_VARIABLE', KOTLIN_PARAMETER: 'DEFAULT_PARAMETER',
  KOTLIN_INSTANCE_PROPERTY: 'DEFAULT_INSTANCE_FIELD', KOTLIN_PACKAGE_PROPERTY: 'DEFAULT_STATIC_FIELD',
  KOTLIN_EXTENSION_PROPERTY: 'DEFAULT_STATIC_FIELD', KOTLIN_CLOSURE_DEFAULT_PARAMETER: 'KOTLIN_PARAMETER',
  KOTLIN_FUNCTION_DECLARATION: 'DEFAULT_FUNCTION_DECLARATION', KOTLIN_FUNCTION_CALL: 'DEFAULT_FUNCTION_CALL',
  KOTLIN_PACKAGE_FUNCTION_CALL: 'DEFAULT_STATIC_METHOD', KOTLIN_EXTENSION_FUNCTION_CALL: 'DEFAULT_STATIC_METHOD',
  KOTLIN_CONSTRUCTOR: 'DEFAULT_FUNCTION_CALL', KOTLIN_SUSPEND_FUNCTION_CALL: 'KOTLIN_FUNCTION_CALL',
  KOTLIN_LABEL: 'DEFAULT_LABEL', KOTLIN_ANNOTATION_ATTRIBUTE_NAME_ATTRIBUTES: 'ANNOTATION_ATTRIBUTE_NAME_ATTRIBUTES',
  // XML / HTML (XmlHighlighterColors)
  XML_TAG: 'DEFAULT_TAG', XML_TAG_NAME: 'DEFAULT_KEYWORD', XML_ATTRIBUTE_NAME: 'DEFAULT_ATTRIBUTE',
  XML_ATTRIBUTE_VALUE: 'DEFAULT_STRING', XML_ENTITY_REFERENCE: 'DEFAULT_ENTITY', XML_PROLOGUE: 'DEFAULT_TAG',
  HTML_TAG: 'XML_TAG', HTML_TAG_NAME: 'XML_TAG_NAME', HTML_ATTRIBUTE_NAME: 'XML_ATTRIBUTE_NAME',
  HTML_ATTRIBUTE_VALUE: 'XML_ATTRIBUTE_VALUE', HTML_ENTITY_REFERENCE: 'XML_ENTITY_REFERENCE',
  // YAML / properties
  YAML_SCALAR_KEY: 'DEFAULT_KEYWORD', YAML_SCALAR_VALUE: 'TEXT', YAML_COMMENT: 'DEFAULT_LINE_COMMENT',
  YAML_ANCHOR: 'DEFAULT_IDENTIFIER', 'PROPERTIES.KEY': 'DEFAULT_KEYWORD', 'PROPERTIES.VALUE': 'DEFAULT_STRING',
  'PROPERTIES.LINE_COMMENT': 'DEFAULT_LINE_COMMENT',
  // Markdown (MarkdownHighlighterColors)
  MARKDOWN_TEXT: 'TEXT', MARKDOWN_BOLD_MARKER: 'DEFAULT_KEYWORD', MARKDOWN_ITALIC_MARKER: 'DEFAULT_KEYWORD',
  MARKDOWN_CODE_SPAN: 'DEFAULT_STRING', MARKDOWN_CODE_SPAN_MARKER: 'DEFAULT_KEYWORD', MARKDOWN_BLOCK_QUOTE: 'DEFAULT_STRING',
  MARKDOWN_BLOCK_QUOTE_MARKER: 'DEFAULT_KEYWORD', MARKDOWN_LIST_MARKER: 'DEFAULT_KEYWORD',
  MARKDOWN_HEADER_MARKER: 'DEFAULT_KEYWORD', MARKDOWN_HEADER_LEVEL_1: 'DEFAULT_CONSTANT',
  MARKDOWN_HEADER_LEVEL_2: 'DEFAULT_CONSTANT', MARKDOWN_HEADER_LEVEL_3: 'DEFAULT_CONSTANT',
  MARKDOWN_HEADER_LEVEL_4: 'DEFAULT_CONSTANT', MARKDOWN_HEADER_LEVEL_5: 'DEFAULT_CONSTANT',
  MARKDOWN_HEADER_LEVEL_6: 'DEFAULT_CONSTANT', MARKDOWN_HRULE: 'DEFAULT_KEYWORD', MARKDOWN_CODE_BLOCK: 'DEFAULT_STRING',
  MARKDOWN_CODE_FENCE: 'DEFAULT_STRING', MARKDOWN_CODE_FENCE_MARKER: 'DEFAULT_KEYWORD',
  MARKDOWN_CODE_FENCE_LANGUAGE: 'DEFAULT_CONSTANT', MARKDOWN_TABLE_SEPARATOR: 'DEFAULT_KEYWORD',
  MARKDOWN_STRIKE_THROUGH: 'DEPRECATED_ATTRIBUTES', MARKDOWN_EXPLICIT_LINK: 'DEFAULT_STRING',
  MARKDOWN_LINK_TEXT: 'HYPERLINK_ATTRIBUTES', MARKDOWN_LINK_DESTINATION: 'DEFAULT_STATIC_METHOD',
  MARKDOWN_LINK_LABEL: 'DEFAULT_KEYWORD',
  // JSON
  JSON_PROPERTY_KEY: 'DEFAULT_INSTANCE_FIELD', JSON_STRING: 'DEFAULT_STRING', JSON_NUMBER: 'DEFAULT_NUMBER',
  JSON_KEYWORD: 'DEFAULT_KEYWORD',
};

/** IntelliJ drops leading zeros ("33b3" = #0033B3); alpha is a 7th/8th digit pair. */
function hex(v) {
  v = String(v).replace(/^#/, '');
  if (v.length < 6) v = v.padStart(6, '0');
  return '#' + v.toUpperCase();
}

function parseXml(file) {
  const xml = fs.readFileSync(path.join(SRC, file), 'utf8');
  return xml;
}

/** Splits a DefaultColorSchemesManager-like file into its <scheme> blocks, or returns the single scheme/list. */
function schemeBlocks(xml) {
  const out = {};
  const re = /<scheme\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/scheme>/g;
  let m;
  while ((m = re.exec(xml))) out[m[1]] = m[2];
  return out;
}

function parseBody(body) {
  const colors = {};
  const attrs = {};
  const cm = /<colors>([\s\S]*?)<\/colors>/.exec(body);
  if (cm) for (const m of cm[1].matchAll(/<option\s+name="([^"]+)"\s+value="([^"]*)"/g)) colors[m[1]] = m[2];
  const am = /<attributes>([\s\S]*?)<\/attributes>/.exec(body) || (/^\s*<list>/.test(body) ? null : null);
  const attrBody = am ? am[1] : body; // plugin scheme fragments are a bare <list> of options
  // top-level <option name="X" [baseAttributes="Y"]/> or <option …><value>…</value></option> (attribute order varies)
  const re = /<option\s+([^>]*?)(\/>|>([\s\S]*?)<\/option>)/g;
  let m;
  while ((m = re.exec(attrBody))) {
    const [, head, , inner] = m;
    const name = /\bname="([^"]+)"/.exec(head)?.[1];
    const base = /\bbaseAttributes="([^"]+)"/.exec(head)?.[1];
    if (!name || /^(FOREGROUND|BACKGROUND|FONT_TYPE|EFFECT_TYPE|EFFECT_COLOR|ERROR_STRIPE_COLOR)$/.test(name)) continue;
    const v = {};
    for (const o of (inner ?? '').matchAll(/<option\s+name="([^"]+)"\s+value="([^"]*)"/g)) v[o[1]] = o[2];
    attrs[name] = base && !Object.keys(v).length ? { base } : base ? { ...v, extends: base } : v;
  }
  return { colors, attrs };
}

/**
 * levels: list of attribute maps, highest priority first. Each level is one "scheme" as IntelliJ sees it:
 * a bundled scheme already contains the directly defined attributes of its bundled parent (EditorColorsSchemeImpl
 * copies them on load), so "Islands Dark" = Darcula + plugin additions + Islands, and Default is the next level.
 * Lookup per level (EditorColorsSchemeImpl/DefaultColorsScheme.getAttributes):
 *   directly defined key → fallback chain within the same level → next level.
 * baseAttributes="X" means "same as X" (resolved from the top again).
 */
function makeScheme(levels, colors) {
  for (const k of Object.keys(colors)) colors[k] = colors[k] === '' ? undefined : hex(colors[k]);
  const attrs = (key, from = 0, depth = 0) => {
    if (!key || depth > 40) return undefined;
    for (let i = from; i < levels.length; i++) {
      for (let k = key; k; k = FALLBACK[k]) {
        const a = levels[i][k];
        if (!a) continue;
        if (a.base) return attrs(a.base, 0, depth + 1);
        if (a.extends) {
          const { extends: b, ...own } = a;
          return { ...(attrs(b, 0, depth + 1) ?? {}), ...own };
        }
        return a;
      }
    }
    return undefined;
  };
  /** Attributes with colors normalized; a missing FOREGROUND means "default text color". */
  const resolve = key => {
    const res = { ...(attrs(key) ?? {}) };
    for (const [p, v] of Object.entries(res)) if (v === '') delete res[p];
    for (const p of ['FOREGROUND', 'BACKGROUND', 'EFFECT_COLOR', 'ERROR_STRIPE_COLOR']) if (res[p]) res[p] = hex(res[p]);
    return res;
  };
  const text = resolve('TEXT');
  /** Foreground with the default text color filled in. */
  const fg = key => resolve(key).FOREGROUND ?? text.FOREGROUND;
  const style = key => {
    const t = Number(resolve(key).FONT_TYPE ?? 0);
    return [t & 1 ? 'bold' : '', t & 2 ? 'italic' : ''].filter(Boolean).join(' ');
  };
  return { colors, resolve, fg, style, text };
}

function load(variant) {
  const mgr = schemeBlocks(parseXml('DefaultColorSchemesManager.xml'));
  const def = parseBody(mgr.Default);
  const merge = parts => Object.assign({}, ...parts.map(p => p.attrs));
  if (variant === 'dark') {
    const darcula = parseBody(mgr.Darcula);
    const plugins = ['Darcula_Kotlin.xml', 'MarkdownDarcula.xml', 'YAMLDarcula.xml', 'XmlDarcula.xml'].map(f => parseBody(parseXml(f)));
    const islands = parseBody(schemeBlocks(parseXml('IslandSchemeDark.xml'))['Islands Dark']);
    const top = [darcula, ...plugins, islands];
    return makeScheme([merge(top), def.attrs], Object.assign({}, def.colors, ...top.map(p => p.colors)));
  }
  const plugins = ['Default_Kotlin.xml', 'MarkdownDefault.xml', 'YAMLDefault.xml', 'XmlIntelliJLight.xml'].map(f => parseBody(parseXml(f)));
  const light = parseBody(schemeBlocks(parseXml('expUI_lightScheme.xml')).Light);
  const top = [def, ...plugins, light];
  return makeScheme([merge(top)], Object.assign({}, ...top.map(p => p.colors)));
}

module.exports = { load, FALLBACK, hex };
