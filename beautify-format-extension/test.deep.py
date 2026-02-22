
import sys,os
from datetime import datetime
import json

# top level comment
def func_with_args( a,b,c=1, *args, **kwargs ):
  if a>b: return a+b
  else: return b-a

@decorator
class MyClass:
  def __init__(self):
    self.x={'key':1,'list':[1,2,3]}

  async def async_method( self ):
    await some_coro()

x = 1+2*3
y = [ 1, 2, 3 ]
z = { 'a': 1, 'b': 2 }
slice = my_list[ 1 : 2 : 3 ]
formatted = f"Value: { x }"
multiline = """
    Line 1
    Line 2
"""

try:
  raise ValueError("Error")
except ValueError as e:
  print(e)
finally:
  pass
