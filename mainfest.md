All resources in browser-sandbox namespace
```bash

guac on  main [!?] on 🐳 v27.5.1 via 🅒 base took 3.2s …
➜ kubectl get all -n browser-sandbox
NAME                                      READY   STATUS             RESTARTS   AGE
pod/browser-sandbox-api-c6fb5b8f7-m27ww   0/1     ImagePullBackOff   0          2m6s
pod/browser-sandbox-api-c6fb5b8f7-rbxmz   0/1     ErrImagePull       0          2m6s
pod/browser-sandbox-api-c6fb5b8f7-zr8zj   0/1     ImagePullBackOff   0          2m6s
pod/guacd-868f98ff56-2bkcj                1/1     Running            0          2m14s
pod/guacd-868f98ff56-nh8ch                1/1     Running            0          2m14s
pod/minio-6787d58685-2ltkj                1/1     Running            0          2m11s
pod/postgres-0                            1/1     Running            0          2m18s
pod/redis-5f86f8f9c7-kpzdg                1/1     Running            0          2m16s

NAME                          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
service/browser-sandbox-api   ClusterIP   10.96.233.237   <none>        8080/TCP   2m9s
service/guacd                 ClusterIP   10.96.71.122    <none>        4822/TCP   2m13s
service/minio                 ClusterIP   10.96.131.72    <none>        9000/TCP   2m11s
service/postgres              ClusterIP   10.96.239.225   <none>        5432/TCP   2m18s
service/redis                 ClusterIP   10.96.126.66    <none>        6379/TCP   2m16s

NAME                                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/browser-sandbox-api   0/3     3            0           2m10s
deployment.apps/guacd                 2/2     2            2           2m15s
deployment.apps/minio                 1/1     1            1           2m12s
deployment.apps/redis                 1/1     1            1           2m17s

NAME                                            DESIRED   CURRENT   READY   AGE
replicaset.apps/browser-sandbox-api-c6fb5b8f7   3         3         0       2m11s
replicaset.apps/guacd-868f98ff56                2         2         2       2m16s
replicaset.apps/minio-6787d58685                1         1         1       2m13s
replicaset.apps/redis-5f86f8f9c7                1         1         1       2m18s

NAME                        READY   AGE
statefulset.apps/postgres   1/1     2m20s

NAME                                  SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cronjob.batch/cleanup-idle-sessions   */5 * * * *   <none>     False     0        <none>          2m5s

```