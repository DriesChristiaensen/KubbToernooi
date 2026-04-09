<template>
  <div class="flex min-h-screen flex-col bg-background">
    <AppHeader />
    <div class="relative z-10 flex-1 pb-20 md:pb-10">
      <slot />
    </div>
    <img
      src="/KubbFieldProfile.png"
      alt=""
      class="pointer-events-none fixed bottom-[32px] left-0 right-0 z-0 w-full object-cover opacity-40 md:opacity-30"
    />
    <AppFooter />
    <HamburgerMenu />
  </div>
</template>
