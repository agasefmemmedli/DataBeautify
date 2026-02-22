# Complex HCL Test

variable "env" {
  type    = string
  default = "dev"
}

resource "aws_instance" "web" {
  ami           = var.env == "prod" ? "ami-prod" : "ami-dev" # Conditional alignment?
  instance_type = lookup({
    dev  = "t2.micro"
    prod = "t3.large"
  }, var.env, "t2.micro") # Function call indentation

  tags = merge(
    {
      Name = "web-server-${var.env}"
    },
    var.extra_tags
  )

  user_data = <<-EOF
    #!/bin/bash
    echo "This is a complex heredoc with indentation"
      if [ "${var.env}" == "prod" ]; then
        echo "Production"
      fi
  EOF
}

# Nested blocks with comments
locals {
  common_tags = {
    Project = "DataBeautify" # Inline comment
    Owner   = "Team"
  }
}

module "vpc" {
  source = "./modules/vpc"

  cidr_block = "10.0.0.0/16"
  subnets = [
    "10.0.1.0/24", # Subnet 1
    "10.0.2.0/24"  # Subnet 2
  ]
}
