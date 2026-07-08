<template>
  <div>
    <FtCard class="card">
      <h2>
        <FontAwesomeIcon
          :icon="['fas', 'info-circle']"
          class="headingIcon"
        />
        {{ $t("About.About") }}
      </h2>
      <section class="brand">
        <h1
          class="logo brandName"
          dir="ltr"
        >
          {{ appName }}
        </h1>
        <div class="version">
          {{ versionNumber }} {{ $t("About.Beta") }}
        </div>
        <div class="unofficialNote">
          {{ $t("About.Unofficial Fork Notice") }}
        </div>
      </section>
      <section class="about-chunks">
        <figure
          v-for="chunk in chunks"
          :key="chunk.title"
          class="chunk"
        >
          <FontAwesomeIcon
            class="icon"
            :icon="chunk.icon"
          />
          <h3 class="title">
            {{ chunk.title }}
          </h3>
          <div
            v-safer-html="chunk.content"
            class="content"
          />
        </figure>
      </section>
    </FtCard>
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FtCard from '../../components/ft-card/ft-card.vue'
import { vSaferHtml } from '../../directives/vSaferHtml.js'

import packageDetails from '../../../../package.json'

const { t } = useI18n()

const versionNumber = `v${packageDetails.version}`
const appName = packageDetails.productName

const chunks = computed(() => [
  {
    icon: ['fab', 'github'],
    title: t('About.Source code'),
    content: [
      '<a href="https://github.com/mangofillet/TabTube" lang="en" dir="ltr">GitHub: mangofillet/TabTube</a>',
      t('About.Licensed under the {licenseLink}', {
        licenseLink: `<a href="https://www.gnu.org/licenses/agpl-3.0.en.html">${t('About.AGPLv3')}</a>`,
      }),
    ].join('<br>'),
  },
  {
    icon: ['fas', 'file-download'],
    title: t('About.Downloads / Changelog'),
    content: `<a href="https://github.com/mangofillet/TabTube/releases">${t('About.GitHub releases')}</a>`,
  },
  {
    icon: ['fas', 'exclamation-circle'],
    title: t('About.Report a problem'),
    content: [
      `<a href="https://github.com/mangofillet/TabTube/issues">${t('About.GitHub issues')}</a>`,
      t('About.Please check for duplicates before posting'),
    ].join('<br>'),
  },
  {
    icon: ['fas', 'users'],
    title: t('About.Credits'),
    content: 'TabTube is an unofficial fork of <a href="https://github.com/FreeTubeApp/FreeTube" lang="en" dir="ltr">FreeTube</a> (AGPL-3.0). Huge thanks to the FreeTube team — please consider supporting them.',
  },
])
</script>

<style scoped src="./About.css" />
