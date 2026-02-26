resource "test" "alignment" {
short = "val"
# This comment should not break alignment
long_argument = "value"
}

resource "test" "heredoc" {
indented = <<-EOF
line1
line2
EOF
}

resource "test" "braces"
{
key = "value"
}
