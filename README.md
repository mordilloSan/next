we need to have installed:

FOR SENSORS API: lm-sensors
FOR PAM:

- Centos and RHEL: yum install pam-devel
- Debian/Ubuntu: apt-get install libpam0g-dev
- debian6/maverick/natty: apt-get install libreadline5-dev


TO DO

1 FOR WIREGUARD

cleanup code for backend.
read only from files?
check conf of clients and server?

2 FOR PACKAGE UPGRADE

packagekit

3 GENERAL

sudo apt update (and similar for other distro) to refresh the package index. => update API. make this a scheduled event? once in 24h?
detect a system restart needed
Implement dbus-next!!!!! This is big....
Implement websocket!!!!!
