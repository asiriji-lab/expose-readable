# syntax=docker/dockerfile:1

# base python image for custom image
FROM python:3.14.0-slim-trixie

# create working directory and install pip dependencies
WORKDIR /backend
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

# copy python project files from local to /solver image working directory
COPY . .

# switch dir
RUN cd /backend

# run the flask server  
CMD [ "python3", "/backend/app.py" ]

# export port
EXPOSE 5000/tcp