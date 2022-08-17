#https://gist.github.com/maxogden/62b7119909a93204c747633308a4d769
# RS256
# private key
openssl genrsa -out rs256-4096-private.rsa 4096
# public key
openssl rsa -in rs256-4096-private.rsa -pubout > rs256-4096-public.pem

# ES512
# private key
openssl ecparam -genkey -name secp521r1 -noout -out ecdsa-p521-private.pem
# public key
openssl ec -in ecdsa-p521-private.pem -pubout -out ecdsa-p521-public.pem 