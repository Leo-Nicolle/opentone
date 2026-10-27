<script setup lang="ts">
// Wide tool pages (frontmatter `layout: ToolLayout`): the page's markdown, H1 and
// intro included, across the whole window under the nav bar, with no sidebar or
// outline, so a tool can lay its panels out in as many columns as fit.
</script>

<template>
  <main class="ToolLayout">
    <Content class="vp-doc" />
  </main>
</template>

<style scoped>
.ToolLayout {
  box-sizing: border-box;
  max-width: 2560px;
  margin: 0 auto;
  padding: 32px 24px 96px;
}
@media (min-width: 768px) {
  .ToolLayout {
    padding: 40px 40px 128px;
  }
}
/* Keep prose at a readable measure; tool components take the full width. */
.ToolLayout :deep(.vp-doc > div > p) {
  max-width: 760px;
}
</style>
