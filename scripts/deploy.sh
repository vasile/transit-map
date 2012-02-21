APP_NAME="sbb"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_FOLDER_TMP=$SCRIPT_DIR/../feed/app/tmp/$APP_NAME
PACKAGE_FOLDER=/tmp/simcity-$APP_NAME
PACKAGE_CACHE=$PACKAGE_FOLDER/feed/app/tmp/$APP_NAME/cache
PACKAGE_GZIP_FILE=$SCRIPT_DIR/../simcity-$APP_NAME.tar.gz

# PREPARE APP FOLDERS
rm -rf $PACKAGE_FOLDER
mkdir -p $PACKAGE_FOLDER/feed

git archive $APP_NAME | tar -x -C $PACKAGE_FOLDER

cd $SCRIPT_DIR/../feed && git archive master | tar -x -C $PACKAGE_FOLDER/feed

mkdir -p $PACKAGE_CACHE/running_sec
mkdir -p $PACKAGE_CACHE/vehicles
chmod 0777 $PACKAGE_CACHE
chmod 0777 $PACKAGE_CACHE/running_sec
chmod 0777 $PACKAGE_CACHE/vehicles

cp $APP_FOLDER_TMP/db_export.db $PACKAGE_CACHE/../

rm -rf $PACKAGE_GZIP_FILE
cd /tmp && tar -czf $PACKAGE_GZIP_FILE simcity-$APP_NAME