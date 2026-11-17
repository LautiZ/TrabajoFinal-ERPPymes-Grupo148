// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      eslintConfigPrettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      // Reducción de la superficie de XSS (TES-70): el JWT es accesible desde JS.
      // Si hay un caso realmente necesario, justificarlo con un comentario:
      //   // eslint-disable-next-line no-restricted-syntax -- motivo
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: 'No asignes innerHTML/outerHTML: es un vector de XSS. Usá bindings de Angular o textContent.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'No uses insertAdjacentHTML: es un vector de XSS.',
        },
        {
          selector: "CallExpression[callee.property.name=/^bypassSecurityTrust/]",
          message: 'No uses bypassSecurityTrust*: desactiva la sanitización de Angular. Justificalo si es imprescindible.',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // También en plantillas (y en las inline): no enlazar HTML arbitrario con [innerHTML].
      'no-restricted-syntax': [
        'error',
        {
          selector: "BoundAttribute[name='innerHTML']",
          message: 'No uses [innerHTML]: es un vector de XSS. Mostrá el texto con interpolación {{ }}.',
        },
        {
          selector: "TextAttribute[name='innerHTML']",
          message: 'No uses innerHTML en plantillas: es un vector de XSS.',
        },
      ],
    },
  }
);