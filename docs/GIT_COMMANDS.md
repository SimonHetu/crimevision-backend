# Git Commands
========================================================================
## View Branches
========================================================================
git branch        # local branches
git branch -r     # remote branches
git branch -a     # all branches

========================================================================
## Publish
========================================================================
git add .  (Ajout seulement)
git add -A (delete et ajout)
git commit
git push origin feature/x

========================================================================
## Visualisation
========================================================================
# Branch Visualisation ASCII
git log --graph --oneline --all
# Branch Visualisation ASCII (with colors)
git log --graph --oneline --decorate --all
# Branch Visualisation ASCII (Compact)
git log --graph --pretty=format:"%C(yellow)%h%Creset %C(cyan)%d%Creset %s" --all

========================================================================
## Go on a task branch and merge current Main branch
========================================================================
# Download remote data, go on a branch of feature X, merge main (with a safety fetch)
git fetch origin
git checkout feature/x
git merge origin/main

========================================================================
## Push on current Task branch
========================================================================
git add .  (Ajout seulement)
git add -A (delete et ajout)
git commit
git push -u origin feature/x

========================================================================
## Push from current Task to Staging
========================================================================
PR to staging in Github

========================================================================
## Push from current Task to Staging
========================================================================
PR to main in Github










## Update origin info, grab current main and 
git fetch origin
git checkout main           // Local main

git merge origin/main
git pull origin main        // Update main from GitHub

## Grab remote info, go on branch X, merge staging 
git fetch origin
git checkout feature/x
git merge origin/staging


# Go on a feature and grab main
git fetch origin
git checkout feature/x
git merge origin/main


## See all branch
git branch -a   