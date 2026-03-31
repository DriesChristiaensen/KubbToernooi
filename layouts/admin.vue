<template>
  <div class="flex min-h-screen flex-col bg-background">
    <AppHeader />
    <AdminStatusBanner />
    <div class="flex-1 pb-20 md:pb-0">
      <slot />
    </div>
    <AppFooter />
    <HamburgerMenu />
  </div>
</template>
