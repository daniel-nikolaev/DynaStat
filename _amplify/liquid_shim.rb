# GitHub Pages pins Liquid 4.0.3, which calls Object#tainted?/#untaint.
# Those methods were removed in Ruby 3.2, so add no-op versions back.
# Only loaded by the Amplify build (see amplify.yml); GitHub Pages doesn't need it.
class Object
  def tainted?; false; end unless method_defined?(:tainted?)
  def untaint; self; end unless method_defined?(:untaint)
end
