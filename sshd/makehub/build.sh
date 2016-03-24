# Need to copy .sh files rather than symlink as docker cares about build context
cp ../issue_invite.sh .
cp ../login.sh .
cp ../supervisord.conf .

docker build .

rm issue_invite.sh login.sh supervisord.conf
