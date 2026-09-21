package bizproof.eligibility

import rego.v1

min_ok if input.conditions.minRevenue == null
min_ok if input.facts.revenue >= input.conditions.minRevenue
max_ok if input.conditions.maxRevenue == null
max_ok if { input.conditions.maxRevenue != null; input.facts.revenue <= input.conditions.maxRevenue }
age_ok if input.facts.deadline == null
age_ok if { input.facts.deadline != null; input.facts.now <= input.facts.deadline }
region_ok if input.conditions.region == null
region_ok if input.conditions.region == ""
region_ok if input.facts.region == input.conditions.region
cert_ok if input.conditions.requireCertification == false
cert_ok if input.facts.certified == true

default minimum := false
minimum := true if min_ok
default maximum := false
maximum := true if max_ok
default age := false
age := true if age_ok
default region := false
region := true if region_ok
default certification := false
certification := true if cert_ok
default eligible := false
eligible := true if { minimum; maximum; age; region; certification }

decision := {
    "revision": "bizproof-eligibility-v1",
    "binding": input.binding,
    "eligible": eligible,
    "checks": {"minRevenue": minimum, "maxRevenue": maximum, "age": age, "region": region, "certification": certification},
}
