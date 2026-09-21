package bizproof.eligibility_test
import rego.v1
import data.bizproof.eligibility.decision

fixture := {"binding":"test","facts":{"revenue":100,"region":"서울","certified":true,"now":10,"deadline":10},"conditions":{"minRevenue":100,"maxRevenue":100,"region":"서울","requireCertification":true}}
test_inclusive_boundaries if { result := decision with input as fixture; result.eligible }
test_wrong_region if { result := decision with input as object.union(fixture,{"facts":object.union(fixture.facts,{"region":"부산"})}); not result.eligible; not result.checks.region }
test_expired_age if { result := decision with input as object.union(fixture,{"facts":object.union(fixture.facts,{"now":11})}); not result.eligible; not result.checks.age }
test_optional_conditions if { result := decision with input as {"binding":"test","facts":{"revenue":0,"region":"부산","certified":false,"now":10,"deadline":null},"conditions":{"minRevenue":null,"maxRevenue":null,"region":null,"requireCertification":false}}; result.eligible }
