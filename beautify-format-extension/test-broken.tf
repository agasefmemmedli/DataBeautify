resource "aws_instance" "example" {
  ami = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "example-instance"
  # Missing closing brace for tags
}

variable "region" {
  default = "us-east-1"
# Missing closing brace for variable
