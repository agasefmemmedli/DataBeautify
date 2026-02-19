
def foo(x,y):
  # comment
  if x>y:
    return x+y
  else:
    return 0

@decorator
class Bar:
  def baz(self,a=1):
    return a*2

x={'a':1,'b':2}
y=[1,2,3]
z=x['a']
long_string = """
  This is a long string
  with indent
"""
f_string = f"Value: {x['a']}"
raw_string = r"Raw \ string"
