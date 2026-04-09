<template>
  <div class="flex min-h-screen flex-col bg-background">
    <AppHeader />
    <div class="flex-1 pb-20 md:pb-0">
      <slot />
    </div>
    <img
      src="/KubbFieldProfile.png"
      alt=""
      class="pointer-events-none fixed bottom-[52px] left-0 right-0 z-0 w-full object-cover opacity-15"
    />
    <AppFooter />
    <HamburgerMenu />
  </div>
</template>
