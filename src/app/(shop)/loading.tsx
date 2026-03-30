const ShopLoading = () => {
  return (
    <div className="container py-20 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">로딩 중...</p>
    </div>
  )
}

export default ShopLoading
