we need to have installed:

FOR SENSORS API

lm-sensors

FOR PAM

Centos and RHEL: yum install pam-devel

Debian/Ubuntu: apt-get install libpam0g-dev

debian6/maverick/natty: apt-get install libreadline5-dev

oneiric (and any newer, eg. Debian 7 or Ubuntu 12.04): apt-get install libreadline-gplv2-dev

FOR WIREGUARD

wireguard
cmake (testing for wireguard C++ manager - https://github.com/Sirherobrine23/Wireguard-tools.js.git)

FOR PACKAGE UPGRADE

packagekit

TO DO

sudo apt update (and similar for other distro) to refresh the package index. => update API. make this a scheduled event? once in 24h?
detect a system restart needed
Implement dbus-next!!!!! This is big....
Implement websocket!!!!!
cache changelog in updates