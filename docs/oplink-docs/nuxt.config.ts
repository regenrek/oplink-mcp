// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [
    '@d0rich/nuxt-content-mermaid'
  ],
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 1
        }
      }
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true,
      autoSubfolderIndex: false
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    provider: 'iconify'
  },

  llms: {
    domain: 'https://oplink.ai/',
    title: 'OPLINK Documentation',
    description: 'Documentation for OPLINK - A powerful MCP workflow orchestration tool.',
    full: {
      title: 'OPLINK - Full Documentation',
      description: 'This is the full documentation for OPLINK.'
    },
    sections: [
      {
        title: 'Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/getting-started%' }
        ]
      },
      {
        title: 'Workflows',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/workflows%' }
        ]
      },
      {
        title: 'Advanced',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/advanced%' }
        ]
      }
    ]
  }

  // llms: {
  //   domain: 'https://viber3d.instructa.ai/',
  //   title: 'Viber3D Documentation',
  //   description:
  //     'Documentation for Viber3D - A modern 3D game starter kit for the web',
  //   full: {
  //     title: 'Viber3D Full Documentation',
  //     description:
  //       'This is the full documentation for the Viber3D game engine'
  //   },
  //   sections: [
  //     {
  //       title: 'Getting Started',
  //       contentCollection: 'docs',
  //       contentFilters: [
  //         { field: 'path', operator: 'LIKE', value: '/getting-started%' }
  //       ]
  //     },
  //     {
  //       title: 'Core Concepts',
  //       contentCollection: 'docs',
  //       contentFilters: [
  //         { field: 'path', operator: 'LIKE', value: '/core-concepts%' }
  //       ]
  //     },
  //     {
  //       title: 'Development',
  //       contentCollection: 'docs',
  //       contentFilters: [
  //         { field: 'path', operator: 'LIKE', value: '/development%' }
  //       ]
  //     }
  //   ]
  // }
})
