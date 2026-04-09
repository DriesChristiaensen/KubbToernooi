<template>
  <div class="flex min-h-screen flex-col bg-background">
    <AppHeader />
    <div class="flex-1 pb-20 md:pb-10">
      <slot />
    </div>
    <AppFooter />
    <HamburgerMenu />
  </div>
</template>
