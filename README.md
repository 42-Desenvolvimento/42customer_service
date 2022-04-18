# WChats

A _very simple_ Ticket System based on WhatsApp messages.

Backend uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) to receive and send WhatsApp messages, create tickets from them and store all in a MySQL database.

Frontend is a full-featured multi-user _chat app_ bootstrapped with react-create-app and Material UI, that comunicates with backend using REST API and Websockets. It allows you to interact with contacts, tickets, send and receive WhatsApp messages.

**NOTE**: I can't guarantee you will not be blocked by using this method, although it has worked for me. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## Motivation

I'm a SysAdmin, and in my daily work, I do a lot of support through WhatsApp. Since WhatsApp Web doesn't allow multiple users, and 90% of our tickets comes from this channel, we created this to share same whatsapp account cross our team.

## How it works?

On every new message received in an associated WhatsApp, a new Ticket is created. Then, this ticket can be reached in a _queue_ on _Tickets_ page, where you can assign ticket to your yourself by _aceppting_ it, respond ticket messagee and eventually _resolve_ it.

Subsequent messages from same contact will be related to first **open/pending** ticket found.

If a contact sent a new message in less than 2 hours interval, and there is no ticket from this contact with **pending/open** status, the newest **closed** ticket will be reopen, instead of creating a new one.

## Screenshots

## Features

- Have multiple users chating in same WhatsApp Number ✅
- Connect to multiple WhatsApp accounts and receive all messages in one place ✅ 🆕
- Create and chat with new contacts without touching cellphone ✅
- Send and receive message ✅
- Send media (images/audio/documents) ✅
- Receive media (images/audio/video/documents) ✅

## Demo

## Installation and Usage (Linux Ubuntu - Development)

Create Mysql Database using docker:
_Note_: change MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_USER and MYSQL_ROOT_PASSWORD.

```bash
docker run --name wchatsdb -e MYSQL_ROOT_PASSWORD=strongpassword -e MYSQL_DATABASE=wchats -e MYSQL_USER=wchats -e MYSQL_PASSWORD=wchats --restart always -p 3306:3306 -d mariadb:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_bin
```

Install puppeteer dependencies:

```bash
sudo apt-get install -y libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

Clone this repo

```bash
git clone https://github.com/ldurans/wchats.com.br.git
```

Go to backend folder and create .env file:

```bash
cp .env.example .env
nano .env
```

Fill `.env` file with environment variables:

```bash
NODE_ENV=DEVELOPMENT #it helps on debugging
BACKEND_URL=http://localhost
FRONTEND_URL=https://localhost:3000
PROXY_PORT=8080
PORT=8080

POSTGRES_HOST= #DB host IP, usually localhost
DB_DIALECT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

JWT_SECRET=3123123213123
JWT_REFRESH_SECRET=75756756756
```

Install backend dependencies, build app, run migrations and seeds:

```bash
npm install
npm run build
npx sequelize db:migrate
npx sequelize db:seed:all
```

Start backend:

```bash
npm start
```

Open a second terminal, go to frontend folder:

Start frontend app:

```bash
npm start
```

- Go to http://your_server_ip:3000/signup
- Create an user and login with it.
- On the sidebard, go to _Connections_ page and create your first WhatsApp connection.
- Wait for QR CODE button to appear, click it and read qr code.
- Done. Every message received by your synced WhatsApp number will appear in Tickets List.
  
## Basic production deployment (Ubuntu 18.04 VPS)

All instructions below assumes you are NOT running as root, since it will give an error in puppeteer. So let's start creating a new user and granting sudo privileges to it:

```bash
adduser deploy
usermod -aG sudo deploy
```

Now we can login with this new user:

```bash
su deploy
```

You'll need two subdomains forwarding to yours VPS ip to follow these instructions. We'll use `myapp.mydomain.com` to frontend and `api.mydomain.com` to backend in the following example.

Update all system packages:

```bash
sudo apt update && sudo apt upgrade
```

Install node and confirm node command is available:

```bash
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

Install docker and add you user to docker group:

```bash
sudo apt install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install docker-ce
sudo systemctl status docker
sudo usermod -aG docker ${USER}
su - ${USER}
```

Create Mysql Database using docker:
_Note_: change MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_USER and MYSQL_ROOT_PASSWORD.

```bash
docker run --name wchatsdb -e MYSQL_ROOT_PASSWORD=strongpassword -e MYSQL_DATABASE=wchats -e MYSQL_USER=wchats -e MYSQL_PASSWORD=wchats --restart always -p 3306:3306 -d mariadb:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_bin
```

Clone this repository:

```bash
cd  ~
git clone https://github.com/ldurans/wchats.com.br.git
```

Create backend .env file and fill with details:

```bash
cp wchats/backend/.env.example wchats/backend/.env
nano wchats/backend/.env
```

```bash
NODE_ENV=
BACKEND_URL=https://api.mydomain.com #USE HTTPS HERE, WE WILL ADD SSL LATTER
FRONTEND_URL=https://myapp.mydomain.com #USE HTTPS HERE, WE WILL ADD SSL LATTER, CORS RELATED!
PROXY_PORT=443 #USE NGINX REVERSE PROXY PORT HERE, WE WILL CONFIGURE IT LATTER
PORT=8080

POSTGRES_HOST=localhost
DB_DIALECT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

JWT_SECRET=3123123213123
JWT_REFRESH_SECRET=75756756756
```

Install puppeteer dependencies:

```bash
sudo apt-get install -y libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

Install backend dependencies, build app, run migrations and seeds:

```bash
cd wchats/backend
npm install
npm run build
npx sequelize db:migrate
npx sequelize db:seed:all
```

Start it with `npm start`, you should see: `Server started on port...` on console. Hit `CTRL + C` to exit.

Install pm2 **with sudo**, and start backend with it:

```bash
sudo npm install -g pm2
pm2 start dist/server.js --name wchats-backend
```

Make pm2 auto start afeter reboot:

```bash
pm2 startup ubuntu -u `YOUR_USERNAME`
```

Copy the last line outputed from previus command and run it, its something like:

```bash
sudo env PATH=\$PATH:/usr/bin pm2 startup ubuntu -u YOUR_USERNAME --hp /home/YOUR_USERNAM
```

Go to frontend folder and install dependencies:

```bash
cd ../frontend
npm install
```

Build frontend app:

```bash
npm run build
```

Start frontend with pm2, and save pm2 process list to start automatically after reboot:

```bash
pm2 start server.js --name wchats-frontend
pm2 save
```

To check if it's running, run `pm2 list`, it should look like:

```bash
deploy@ubuntu-whats:~$ pm2 list

┌─────┬─────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐

│ id │ name │ namespace │ version │ mode │ pid │ uptime │ . │ status │ cpu │ mem │ user │ watching │

├─────┼─────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤

│ 1 │ wchats-frontend │ default │ 0.1.0 │ fork │ 179249 │ 12D │ 0 │ online │ 0.3% │ 50.2mb │ deploy │ disabled │

│ 6 │ wchats-backend │ default │ 1.0.0 │ fork │ 179253 │ 12D │ 15 │ online │ 0.3% │ 118.5mb │ deploy │ disabled │

└─────┴─────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘

```

Install nginx:

```bash
sudo apt install nginx
```

Remove nginx default site:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Create a new nginx site to frontend app:

```bash
sudo nano /etc/nginx/sites-available/wchats-frontend
```

Edit and fill it with this information, changing `server_name` to yours equivalent to `myapp.mydomain.com`:

```bash
server {
  server_name myapp.mydomain.com;

  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }

}

```

Create another one to backend api, changing `server_name` to yours equivalent to `api.mydomain.com`, and `proxy_pass` to your localhost backend node server URL:

```bash
sudo cp /etc/nginx/sites-available/wchats-frontend /etc/nginx/sites-available/wchats-backend
sudo nano /etc/nginx/sites-available/wchats-backend
```

```bash
server {
  server_name api.mydomain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
......
}

```

Create a symbolic links to enalbe nginx sites:

```bash
sudo ln -s /etc/nginx/sites-available/wchats-frontend /etc/nginx/sites-enabled
sudo ln -s /etc/nginx/sites-available/wchats-backend /etc/nginx/sites-enabled
```

By default, nginx limit body size to 1MB, what isn't enough to some media uploads. Lets change it to 20MB adding a new line to config file:

```bash
sudo nano /etc/nginx/nginx.conf
...

http {
  ...
  client_max_body_size 20M;  # HANDLE BIGGER UPLOADS
}

```

Test nginx configuration and restart server:

```bash
sudo nginx -t
sudo service nginx restart
```

Now, enable SSL (https) on your sites to use all app features like notifications and sending audio messages. A easy way to this is using Certbot:

Install certbor with snapd:

```bash
sudo snap install --classic certbot
```

Enable SSL on nginx (Accept all information asked):

```bash
sudo certbot --nginx
```

## Upgrading

wchats is a working in progress and we are adding new features frequently. To update your old installation and get all the new features, you can use a bash script like this:

**Note**: Always check the .env.example and adjust your .env file before upgrading, since some new variable may be added.

```bash
nano updateWChats
```

```bash
#!/bin/bash
echo  "Updating WChats, please wait."
cd  ~
cd wchats
git pull
cd backend
npm install
rm -rf dist
npm run build
npx sequelize db:migrate
npx sequelize db:seed
cd ../frontend
npm install
rm -rf build
npm run build
pm2 restart all

echo  "Update finished. Enjoy!"
```

Make it executable and run it:

```bash
chmod +x updateWChats
./updateWChats
```

## Disclaimer

I just started leaning Javascript a few months ago and this is my first project. It may have security issues and many bugs. I recommend using it only on local network.

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at https://whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.

