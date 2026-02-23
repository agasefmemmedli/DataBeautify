resource "foo" "bar" {
  tags = merge(
    {
      Name = "test"
    },
    var.extra_tags
  )
}
