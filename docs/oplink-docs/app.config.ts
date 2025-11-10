export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sky',
      neutral: 'zinc'
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'Oplink'
  },
  header: {
    title: '',
    to: '/',
    logo: {
      alt: '',
      light: '',
      dark: ''
    },
    search: true,
    colorMode: true,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/regenrek/oplink',
      'target': '_blank',
      'aria-label': 'oplink on GitHub'
    }]
  },
  footer: {
    credits: `Copyright © ${new Date().getFullYear()} oplink | Made by`,
    colorMode: false,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/regenrek/oplink',
      'target': '_blank',
      'aria-label': 'oplink on GitHub'
    }]
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Community',
      edit: 'https://github.com/regenrek/oplink/edit/main/docs',
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/regenrek/oplink',
        target: '_blank'
      }]
    }
  },
  contentMermaid: {
    enabled: true,
    color: 'default'
  }
})
