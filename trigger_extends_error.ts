try {
  const mod: any = { default: undefined };
  const { _extends } = mod.default;
} catch (e: any) {
  console.log('Error triggered:', e.message);
  console.log('Stack:', e.stack);
}
