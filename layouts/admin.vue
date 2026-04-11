<template>
  <div class="flex min-h-screen flex-col bg-background pt-14 md:pt-0">
    <AppHeader />
    <AdminStatusBanner />
    <div class="flex-1 pb-20 md:pb-10">
      <slot />
    </div>
    <AppFooter />
    <HamburgerMenu />
  </div>
</template>
