 #!/usr/bin/env python


import socket

HOST = 'localhost'
PORT = 8080
size = 1024
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind((HOST, PORT))
s.listen(1)
while 1:
    client, address = s.accept()
    data = client.recv(size)
    if data:
        client.send(data)
    client.close() 
